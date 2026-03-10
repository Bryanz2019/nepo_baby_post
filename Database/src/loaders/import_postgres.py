import os
import psycopg2
import pandas as pd
from io import StringIO
from dotenv import load_dotenv
from pathlib import Path

data_path = Path(__file__).parent.parent.parent.resolve()
print(data_path)

# ------------------------------------------------------------------
# Hardcoded base data folder (ONLY place paths are defined)
# ------------------------------------------------------------------

DATA_DIR = f"{data_path}/Data/raw/processed"


# ------------------------------------------------------------------
# Load environment variables
# ------------------------------------------------------------------
load_dotenv()

PG_CONN = {
    "host": os.getenv("PG_HOST", "localhost"),
    "port": int(os.getenv("PG_PORT", "5432")),
    "dbname": os.getenv("PG_DBNAME", "nepo"),
    "user": os.getenv("PG_USER", "nepo_user"),
    "password": os.getenv("PG_PASSWORD", "secure_password"),
}

print(PG_CONN)

RAW_SCHEMA = "raw"

# ------------------------------------------------------------------
# DB helpers
# ------------------------------------------------------------------
def get_conn():
    return psycopg2.connect(**PG_CONN)

def ensure_schema(conn, schema: str = RAW_SCHEMA):
    with conn.cursor() as cur:
        cur.execute(f"CREATE SCHEMA IF NOT EXISTS {schema};")
    conn.commit()

def ensure_table(conn, create_sql: str):
    with conn.cursor() as cur:
        cur.execute(create_sql)
    conn.commit()

def drop_table_if_exists(conn, schema: str, table: str):
    with conn.cursor() as cur:
        cur.execute(f"DROP TABLE IF EXISTS {schema}.{table} CASCADE;")
    conn.commit()

def copy_from_df(conn, df: pd.DataFrame, table_fq: str):
    df = df.where(pd.notna(df), None)

    buffer = StringIO()
    df.to_csv(buffer, index=False, header=False, na_rep="")
    buffer.seek(0)

    with conn.cursor() as cur:
        cur.copy_expert(f"COPY {table_fq} FROM STDIN WITH CSV", buffer)
    conn.commit()

# ------------------------------------------------------------------
# IMDb titles → raw.title
# ------------------------------------------------------------------
def load_imdb_titles():
    print("Loading IMDb titles...")
    conn = get_conn()
    ensure_schema(conn)

    drop_table_if_exists(conn, RAW_SCHEMA, "title")

    ensure_table(conn, f"""
        CREATE TABLE {RAW_SCHEMA}.title (
            tconst TEXT,
            titleType TEXT,
            primaryTitle TEXT,
            originalTitle TEXT,
            isAdult INTEGER,
            startYear TEXT,
            endYear TEXT,
            runtimeMinutes TEXT,
            genres TEXT
        );
    """)

    path = os.path.join(DATA_DIR, "title_movie.csv")

    for i, chunk in enumerate(pd.read_csv(path, chunksize=250_000)):
        df = chunk[
            [
                "tconst",
                "titleType",
                "primaryTitle",
                "originalTitle",
                "isAdult",
                "startYear",
                "endYear",
                "runtimeMinutes",
                "genres",
            ]
        ].copy()
        copy_from_df(conn, df, f"{RAW_SCHEMA}.title")
        print(f"  Loaded title chunk {i + 1}")

    conn.close()

# ------------------------------------------------------------------
# IMDb TV series → raw.title (append)
# ------------------------------------------------------------------
def load_tv_series():
    print("Loading TV series...")
    conn = get_conn()
    ensure_schema(conn)

    path = os.path.join(DATA_DIR, "title_tvSeries.csv")

    for i, chunk in enumerate(pd.read_csv(path, chunksize=250_000)):
        df = chunk[
            [
                "tconst",
                "titleType",
                "primaryTitle",
                "originalTitle",
                "isAdult",
                "startYear",
                "endYear",
                "runtimeMinutes",
                "genres",
            ]
        ].copy()

        copy_from_df(conn, df, f"{RAW_SCHEMA}.title")
        print(f"  Loaded TV series chunk {i + 1}")

    conn.close()


# ------------------------------------------------------------------
# Wikidata people → raw.person
# ------------------------------------------------------------------
def load_people():
    print("Loading people...")
    conn = get_conn()
    ensure_schema(conn)

    drop_table_if_exists(conn, RAW_SCHEMA, "person")

    ensure_table(conn, f"""
        CREATE TABLE {RAW_SCHEMA}.person (
            person TEXT,
            name TEXT,
            gender TEXT,
            birthDate TEXT,
            IMDb TEXT
        );
    """)

    path = os.path.join(DATA_DIR, "person.csv")

    for i, chunk in enumerate(pd.read_csv(path, chunksize=100_000)):
        df = chunk[["person", "name", "gender", "birthDate", "IMDb"]].copy()
        copy_from_df(conn, df, f"{RAW_SCHEMA}.person")
        print(f"  Loaded person chunk {i + 1}")

    conn.close()

# ------------------------------------------------------------------
# Wikidata person images → raw.person_image
# ------------------------------------------------------------------
def load_person_images():
    print("Loading person images...")
    conn = get_conn()
    ensure_schema(conn)

    drop_table_if_exists(conn, RAW_SCHEMA, "person_image")

    ensure_table(conn, f"""
        CREATE TABLE {RAW_SCHEMA}.person_image (
            person    TEXT,
            imageUrl  TEXT
        );
    """)

    path = os.path.join(DATA_DIR, "person_images.csv")

    for i, chunk in enumerate(pd.read_csv(path, chunksize=100_000)):
        df = chunk[["person", "imageUrl"]].copy()
        copy_from_df(conn, df, f"{RAW_SCHEMA}.person_image")
        print(f"  Loaded person image chunk {i + 1}")

    conn.close()

# # ------------------------------------------------------------------
# # Parent–child relationships → raw.relationship
# # ------------------------------------------------------------------
# def load_relationship():
#     print("Loading relationships...")
#     conn = get_conn()
#     ensure_schema(conn)

#     drop_table_if_exists(conn, RAW_SCHEMA, "relationship")

#     ensure_table(conn, f"""
#         CREATE TABLE {RAW_SCHEMA}.relationship (
#             person TEXT,
#             relationship TEXT,
#             related_person TEXT
#         );
#     """)

#     path = os.path.join(DATA_DIR, "relation.csv")
#     df = pd.read_csv(path)
#     copy_from_df(conn, df, f"{RAW_SCHEMA}.relationship")

#     conn.close()


# ------------------------------------------------------------------
# Wikidata parents (US + CA) → raw.parent
# ------------------------------------------------------------------
def load_parent():
    print("Loading parents (US + CA)...")
    conn = get_conn()
    ensure_schema(conn)

    drop_table_if_exists(conn, RAW_SCHEMA, "parent")

    ensure_table(conn, f"""
        CREATE TABLE {RAW_SCHEMA}.parent (
            personId       TEXT,
            fatherId       TEXT,
            motherId       TEXT,
            source_country TEXT   -- 'US' or 'CA'
        );
    """)

    # ---------- US ----------
    us_path = os.path.join(DATA_DIR, "parent_us.csv")
    df_us = pd.read_csv(us_path)
    df_us["source_country"] = "US"
    copy_from_df(conn, df_us[["personId", "fatherId", "motherId", "source_country"]], f"{RAW_SCHEMA}.parent")
    print(f"  Loaded US parents, rows: {len(df_us)}")

    # ---------- CA ----------
    ca_path = os.path.join(DATA_DIR, "parent_ca.csv")
    df_ca = pd.read_csv(ca_path)
    df_ca["source_country"] = "CA"
    copy_from_df(conn, df_ca[["personId", "fatherId", "motherId", "source_country"]], f"{RAW_SCHEMA}.parent")
    print(f"  Loaded CA parents, rows: {len(df_ca)}")

    conn.close()


# ------------------------------------------------------------------
# Wikidata relatives (US + CA) → raw.relative
# ------------------------------------------------------------------
def load_relative():
    print("Loading relatives (US + CA)...")
    conn = get_conn()
    ensure_schema(conn)

    drop_table_if_exists(conn, RAW_SCHEMA, "relative")

    ensure_table(conn, f"""
        CREATE TABLE {RAW_SCHEMA}.relative (
            personId       TEXT,
            relativeId     TEXT,
            kinshipId      TEXT,
            kinshipLabel   TEXT,
            source_country TEXT   -- 'US' or 'CA'
        );
    """)

    # ---------- US ----------
    us_path = os.path.join(DATA_DIR, "relative_us.csv")
    df_us = pd.read_csv(us_path)
    df_us["source_country"] = "US"
    # (kinshipId/kinshipLabel may be missing in some files; fill if needed)
    for col in ["kinshipId", "kinshipLabel"]:
        if col not in df_us.columns:
            df_us[col] = ""
    copy_from_df(
        conn,
        df_us[["personId", "relativeId", "kinshipId", "kinshipLabel", "source_country"]],
        f"{RAW_SCHEMA}.relative",
    )
    print(f"  Loaded US relatives, rows: {len(df_us)}")

    # ---------- CA ----------
    ca_path = os.path.join(DATA_DIR, "relative_ca.csv")
    df_ca = pd.read_csv(ca_path)
    df_ca["source_country"] = "CA"
    for col in ["kinshipId", "kinshipLabel"]:
        if col not in df_ca.columns:
            df_ca[col] = ""
    copy_from_df(
        conn,
        df_ca[["personId", "relativeId", "kinshipId", "kinshipLabel", "source_country"]],
        f"{RAW_SCHEMA}.relative",
    )
    print(f"  Loaded CA relatives, rows: {len(df_ca)}")

    conn.close()


# ------------------------------------------------------------------
# IMDb principals → raw.principal
# ------------------------------------------------------------------
def load_principal():
    print("Loading title principals...")
    conn = get_conn()
    ensure_schema(conn)

    drop_table_if_exists(conn, RAW_SCHEMA, "principal")

    ensure_table(conn, f"""
        CREATE TABLE {RAW_SCHEMA}.principal (
            tconst TEXT,
            ordering INTEGER,
            nconst TEXT,
            category TEXT,
            job TEXT,
            characters TEXT
        );
    """)

    path = os.path.join(DATA_DIR, "principals.csv")

    for i, chunk in enumerate(pd.read_csv(path, chunksize=500_000)):
        df = chunk[["tconst", "ordering", "nconst", "category", "job", "characters"]].copy()
        copy_from_df(conn, df, f"{RAW_SCHEMA}.principal")
        print(f"  Loaded principals chunk {i + 1}")

    conn.close()


# ------------------------------------------------------------------
# IMDb ratings → raw.rating
# ------------------------------------------------------------------
def load_ratings():
    print("Loading ratings...")
    conn = get_conn()
    ensure_schema(conn)

    drop_table_if_exists(conn, RAW_SCHEMA, "rating")

    ensure_table(conn, f"""
        CREATE TABLE {RAW_SCHEMA}.rating (
            tconst TEXT,
            averageRating TEXT,
            numVotes TEXT
        );
    """)

    path = os.path.join(DATA_DIR, "title_ratings.csv")

    for i, chunk in enumerate(pd.read_csv(path, chunksize=500_000)):
        df = chunk[["tconst", "averageRating", "numVotes"]].copy()
        copy_from_df(conn, df, f"{RAW_SCHEMA}.rating")
        print(f"  Loaded rating chunk {i + 1}")

    conn.close()


# ------------------------------------------------------------------
# Wikidata movie awards & nominations → raw.movie_award_nomination
# ------------------------------------------------------------------
def load_movie_award():
    print("Loading movie award nominations...")
    conn = get_conn()
    ensure_schema(conn)

    drop_table_if_exists(conn, RAW_SCHEMA, "movieaward")

    ensure_table(conn, f"""
        CREATE TABLE {RAW_SCHEMA}.movieaward (
            film_wikiId    TEXT,
            film_name      TEXT,
            imdb_id        TEXT,
            type           TEXT,
            award_wikiId   TEXT,
            award_name     TEXT,
            award_year     TEXT
        );
    """)

    path = os.path.join(DATA_DIR, "title_awards_noms.csv")

    for i, chunk in enumerate(pd.read_csv(path, chunksize=200_000)):
        df = chunk[
            [
                "film_wikiId",
                "film_name",
                "imdb_id",
                "type",
                "award_wikiId",
                "award_name",
                "award_year",
            ]
        ].copy()

        copy_from_df(conn, df, f"{RAW_SCHEMA}.movieaward")
        print(f"  Loaded movie award chunk {i + 1}")

    conn.close()

# ------------------------------------------------------------------
# Wikidata people awards & nominations (US + CA) → raw.people_award
# ------------------------------------------------------------------
def load_people_awards():
    print("Loading people awards (US + CA)...")
    conn = get_conn()
    ensure_schema(conn)

    # Drop once, create once
    drop_table_if_exists(conn, RAW_SCHEMA, "peopleaward")

    ensure_table(conn, f"""
        CREATE TABLE {RAW_SCHEMA}.peopleaward (
            person_wikiId  TEXT,
            type           TEXT,
            award_wikiId   TEXT,
            award_name     TEXT,
            award_year     TEXT,
            source_country TEXT   -- 'US' or 'CA'
        );
    """)

    # ---------- US , CA ----------
    us_path = os.path.join(DATA_DIR, "person_awards_noms.csv")

    for i, chunk in enumerate(pd.read_csv(us_path, chunksize=200_000)):
        df = chunk[
            [
                "person_wikiId",
                "type",
                "award_wikiId",
                "award_name",
                "award_year",
            ]
        ].copy()

        df["source_country"] = "US or CA"  # (since this file may contain both US and CA data)

        copy_from_df(conn, df, f"{RAW_SCHEMA}.peopleaward")
        print(f"  Loaded US people award chunk {i + 1}")


    conn.close()

# ------------------------------------------------------------------
# Main
# ------------------------------------------------------------------
if __name__ == "__main__":
    # load_imdb_titles()
    # load_tv_series()
    # load_people()
    load_person_images()       
    # load_principal()
    # load_ratings()
    # load_movie_award()
    # load_people_awards()
    # load_parent()
    # load_relative()

    print("✅ Loader finished")
