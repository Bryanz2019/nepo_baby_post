/* ============================================================
   Nepo Baby Project — CORE DDL + LOAD (TEAM TEMPLATE)
   ------------------------------------------------------------
   RULES (IMPORTANT):
   1) Each teammate owns ONE block: {core.<object>}
   2) Inside your block you may include:
        - DROP TABLE IF EXISTS ... CASCADE;
        - CREATE TABLE ...
        - CREATE INDEX ...
        - INSERT INTO ... SELECT ...
   3) Put err views in Section ERR (optional, but recommended)
   4) Put only SELECT checks in Section VALIDATION
   5) Do NOT edit other people's blocks (request change via review comments)
   ============================================================ */



/* ============================================================
   SECTION 0 — SCHEMA (DO NOT MODIFY)
   ============================================================ */

CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS err;

/* ============================================================
   SECTION 1 — CORE TABLES + LOAD
   ============================================================ */

-------------------- {core.person} ---------------------
-- OWNER: <Emma>
-- SOURCE: raw.person
-- DEPENDS ON: (none)

DROP TABLE IF EXISTS core.person CASCADE;

CREATE TABLE IF NOT EXISTS core.person (
    person_id   VARCHAR(20) PRIMARY KEY,
    name        VARCHAR(60) NOT NULL,
    gender      VARCHAR(20),
    birthdate   DATE,
    nconst      VARCHAR(12)          -- IMDb nconst (nullable)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_person_name
    ON core.person (name);

-- Load (dedupe: if duplicate person_id + birthdate, keep 1 row; prefer earliest birthdate overall)
-- Load (dedupe: one row per person; earliest birthdate; filter out invalid birthDate strings)
-- Load (extract QID via substring; enforce Q+digits; filter bad birthDate + gender URI; dedupe)
INSERT INTO core.person (
    person_id,
    name,
    gender,
    birthdate,
    nconst
)
WITH cleaned AS (
    SELECT
        regexp_replace(trim(p.person), '^.*/(Q[0-9]+)$', '\1') AS person_id,
        TRIM(p.name)                                       AS name,

        NULLIF(TRIM(p.gender), '')                         AS gender,
        TRIM(p.gender)                                     AS gender_raw,

        CASE
            WHEN p.birthDate IS NULL OR NULLIF(TRIM(p.birthDate), '') IS NULL THEN NULL
            WHEN TRIM(p.birthDate) ~ '^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$'
                THEN TRIM(p.birthDate)::timestamptz::date
            ELSE NULL
        END                                                AS birthdate,
        TRIM(p.birthDate)                                  AS birthdate_raw,

        CASE
            WHEN TRIM(p.IMDb) ~ '^nm[0-9]+$' THEN TRIM(p.IMDb)
            ELSE NULL
        END                                                AS nconst
    FROM raw.person p
    WHERE p.person IS NOT NULL
      AND NULLIF(TRIM(p.name), '') IS NOT NULL
),
filtered AS (
    SELECT *
    FROM cleaned
    WHERE
        -- enforce Q + digits (and ensure extraction succeeded)
        person_id IS NOT NULL
        AND person_id ~ '^Q[0-9]+$'

        -- FILTER OUT: birthDate exists but isn't parseable
        AND NOT (
            birthdate_raw IS NOT NULL
            AND birthdate_raw <> ''
            AND birthdate IS NULL
        )

        -- FILTER OUT: gender looks like a URI (starts with http)
        AND NOT (
            gender_raw IS NOT NULL
            AND gender_raw <> ''
            AND lower(gender_raw) LIKE 'http%'
        )
),
ranked AS (
    SELECT
        f.person_id,
        f.name,
        f.gender,
        f.birthdate,
        f.nconst,
        ROW_NUMBER() OVER (
            PARTITION BY f.person_id
            ORDER BY
                f.birthdate NULLS LAST,     -- earliest birthdate wins
                (f.nconst IS NULL),         -- prefer having nconst
                f.nconst,
                f.name,
                f.gender
        ) AS rn
    FROM filtered f
)
SELECT
    person_id,
    name,
    gender,
    birthdate,
    nconst
FROM ranked
WHERE rn = 1;


-------------------- {core.award} ---------------------
-- OWNER: <Emma>
-- SOURCE: raw.movieaward + raw.peopleaward
-- DEPENDS ON: (none)

DROP TABLE IF EXISTS core.award CASCADE;

CREATE TABLE IF NOT EXISTS core.award (
    award_id  VARCHAR(80) PRIMARY KEY,   -- Wikidata QID
    name      VARCHAR(150) NOT NULL
);

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_award_name
    ON core.award (name);

-- Load (dedupe by award_id, prefer longer/more descriptive name)
WITH unioned AS (
    SELECT
        NULLIF(TRIM(award_wikiid), '') AS award_id,
        NULLIF(TRIM(award_name), '')   AS name
    FROM raw.movieaward

    UNION ALL

    SELECT
        NULLIF(TRIM(award_wikiid), '') AS award_id,
        NULLIF(TRIM(award_name), '')   AS name
    FROM raw.peopleaward
),
filtered AS (
    SELECT *
    FROM unioned
    WHERE award_id IS NOT NULL
      AND award_id ~ '^Q[0-9]+$'
      AND name IS NOT NULL
),
ranked AS (
    SELECT
        award_id,
        name,
        ROW_NUMBER() OVER (
            PARTITION BY award_id
            ORDER BY LENGTH(name) DESC, name
        ) AS rn
    FROM filtered
)
INSERT INTO core.award (award_id, name)
SELECT award_id, name
FROM ranked
WHERE rn = 1;


-------------------- {core.title} ---------------------
-- OWNER: <Bryan>
-- SOURCE: raw.title
-- DEPENDS ON: (none)
-------------------------------------------------------

DROP TABLE IF EXISTS core.title CASCADE;

CREATE TABLE IF NOT EXISTS core.title (

    tconst          VARCHAR(10) PRIMARY KEY,
    title_type      VARCHAR(10) NOT NULL,
    primary_title   VARCHAR(255),
    original_title  VARCHAR(255),
    is_adult        BOOLEAN NOT NULL,
    start_year      SMALLINT,
    end_year        SMALLINT,
    runtime_minutes SMALLINT
);

--  Indexes
CREATE INDEX IF NOT EXISTS idx_title_primary_title
    ON core.title (primary_title);

CREATE INDEX IF NOT EXISTS idx_title_start_year
    ON core.title (start_year);

--  Load
INSERT INTO core.title (
    tconst,
    title_type,
    primary_title,
    original_title,
    is_adult,
    start_year,
    end_year,
    runtime_minutes
)
SELECT DISTINCT ON (t.tconst)
    t.tconst                                    AS tconst,
    NULLIF(TRIM(t.titleType), '')               AS title_type,
    NULLIF(TRIM(t.primaryTitle), '')            AS primary_title,
    NULLIF(TRIM(t.originalTitle), '')           AS original_title,

    CASE
        WHEN t.isAdult = 1 THEN TRUE
        ELSE FALSE
    END                                         AS is_adult,

    CAST(t.startYear AS NUMERIC)::SMALLINT      AS start_year,
    CAST(t.endYear AS NUMERIC)::SMALLINT        AS end_year,
    CAST(t.runtimeMinutes AS NUMERIC)::SMALLINT AS runtime_minutes

FROM raw.title t
WHERE t.tconst IS NOT NULL
ORDER BY tconst ASC, primary_title ASC, title_type DESC;


-------------------- {core.genres} ---------------------
-- OWNER: <Bryan>
-- SOURCE: raw.title
-- DEPENDS ON: (none)
--------------------------------------------------------

DROP TABLE IF EXISTS core.genres CASCADE;

CREATE TABLE IF NOT EXISTS core.genres (
    tconst VARCHAR(10) NOT NULL,
    genre  VARCHAR(255) NOT NULL,
    PRIMARY KEY (tconst, genre),
    FOREIGN KEY (tconst) REFERENCES core.title (tconst)
);

--  Load
INSERT INTO core.genres (
    tconst,
    genre
)
SELECT DISTINCT
    t.tconst            AS tconst,
    TRIM(g.genre)       AS genre
FROM raw.title t
CROSS JOIN LATERAL
    unnest( regexp_split_to_array( TRIM(t.genres), '\s*,\s*' ) ) AS g(genre)
WHERE t.tconst IS NOT NULL
    AND NULLIF(TRIM(t.genres), '') IS NOT NULL
    AND TRIM(g.genre) <> '';


-------------------- {core.relationship} ---------------------
-- OWNER: <Xiang>
-- SOURCE: raw.parent, raw.relative
-- DEPENDS ON: core.person

DROP TABLE IF EXISTS core.relationship CASCADE;

CREATE TABLE IF NOT EXISTS core.relationship (
    person_id           VARCHAR(50)  NOT NULL,           -- Wikidata Q-id (e.g. Q12345678)
    relationship        VARCHAR(50)  NOT NULL,           -- father / mother / relative...
    related_person_id   VARCHAR(50)  NOT NULL,           -- Wikidata Q-id (e.g. Q12345678)
    PRIMARY KEY (person_id, related_person_id)
);

--  Indexes

CREATE INDEX IF NOT EXISTS idx_relationship_relationship
    ON core.relationship (relationship);

--  Load data

WITH parent_clean AS (
    SELECT
        regexp_replace(TRIM(personid), '^.*/(Q\d+)$', '\1', 'i') AS person_id,
        regexp_replace(TRIM(fatherid), '^.*/(Q\d+)$', '\1', 'i') AS father_id,
        regexp_replace(TRIM(motherid), '^.*/(Q\d+)$', '\1', 'i') AS mother_id
    FROM raw.parent
    WHERE regexp_replace(TRIM(personid), '^.*/(Q\d+)$', '\1', 'i') != 'Q55834640'
),

valid_parent_clean AS (
    SELECT *
    FROM parent_clean
    WHERE person_id ~ '^Q\d+$'
      AND (father_id IS NULL OR father_id ~ '^Q\d+$')
      AND (mother_id IS NULL OR mother_id ~ '^Q\d+$')
),

bad_fathers AS (
    SELECT person_id
    FROM valid_parent_clean
    WHERE father_id IS NOT NULL
    GROUP BY person_id
    HAVING COUNT(DISTINCT father_id) > 1
),

bad_mothers AS (
    SELECT person_id
    FROM valid_parent_clean
    WHERE mother_id IS NOT NULL
    GROUP BY person_id
    HAVING COUNT(DISTINCT mother_id) > 1
),

good_people AS (
    SELECT DISTINCT person_id
    FROM valid_parent_clean
    WHERE person_id NOT IN (SELECT person_id FROM bad_fathers)
      AND person_id NOT IN (SELECT person_id FROM bad_mothers)
),

father_edges AS (
    SELECT DISTINCT
        v.person_id,
        v.father_id AS related_person_id,
        'father' AS relationship
    FROM valid_parent_clean v
    JOIN good_people g ON g.person_id = v.person_id
    WHERE v.father_id IS NOT NULL
),

mother_edges AS (
    SELECT DISTINCT
        v.person_id,
        v.mother_id AS related_person_id,
        'mother' AS relationship
    FROM valid_parent_clean v
    JOIN good_people g ON g.person_id = v.person_id
    WHERE v.mother_id IS NOT NULL
),

parent_edges AS (
    SELECT * FROM father_edges
    UNION ALL
    SELECT * FROM mother_edges
)

INSERT INTO core.relationship (person_id, related_person_id, relationship)
SELECT e.person_id, e.related_person_id, e.relationship
FROM parent_edges e;

-- -- -----------------------------
-- -- siblings: from raw.sibling
-- -- -----------------------------
-- INSERT INTO core.relationship (person_id, related_person_id, relationship)
-- SELECT DISTINCT
--     TRIM(s.personid)  AS person_id,
--     TRIM(s.siblingid) AS related_person_id,
--     'sibling'         AS relationship
-- FROM raw.sibling s
-- WHERE s.personid  IS NOT NULL
--   AND s.siblingid IS NOT NULL
--   AND TRIM(s.personid)  ~ '^Q[0-9]+$'
--   AND TRIM(s.siblingid) ~ '^Q[0-9]+$'
--   AND TRIM(s.personid) <> TRIM(s.siblingid)
--   AND EXISTS (SELECT 1 FROM core.person p WHERE p.person_id = TRIM(s.personid))
--   AND EXISTS (SELECT 1 FROM core.person p WHERE p.person_id = TRIM(s.siblingid))
-- ON CONFLICT (person_id, related_person_id) DO NOTHING;




-- -- -----------------------------
-- -- siblings: from raw.spouse
-- -- -----------------------------
INSERT INTO core.relationship (person_id, related_person_id, relationship)
SELECT DISTINCT
    TRIM(s.personid)  AS person_id,
    TRIM(s.spouseid) AS related_person_id,
    'spouse'         AS relationship
FROM raw.spouse s
WHERE s.personid  IS NOT NULL
  AND s.spouseid IS NOT NULL
  AND TRIM(s.personid)  ~ '^Q[0-9]+$'
  AND TRIM(s.spouseid) ~ '^Q[0-9]+$'
  AND TRIM(s.personid) <> TRIM(s.spouseid)
  AND EXISTS (SELECT 1 FROM core.person p WHERE p.person_id = TRIM(s.personid))
  AND EXISTS (SELECT 1 FROM core.person p WHERE p.person_id = TRIM(s.spouseid))
ON CONFLICT (person_id, related_person_id) DO NOTHING;


-- -----------------------------
-- relatives: kinshiplabel or default 'relative'
-- -----------------------------
WITH cleaned AS (
    SELECT
        TRIM(personid) AS person_id,
        TRIM(relativeid) AS related_person_id,
        COALESCE(
            LOWER(NULLIF(TRIM(kinshiplabel), '')),
            'relative'
        ) AS relationship
    FROM raw.relative
    WHERE personid IS NOT NULL
      AND relativeid IS NOT NULL
),
one_rel_pairs AS (
    SELECT person_id, related_person_id
    FROM cleaned
    GROUP BY person_id, related_person_id
    HAVING COUNT(DISTINCT relationship) = 1
),
dedup_rows AS (
    SELECT DISTINCT person_id, related_person_id, relationship
    FROM cleaned
)

INSERT INTO core.relationship (person_id, related_person_id, relationship)
SELECT d.person_id, d.related_person_id, d.relationship
FROM dedup_rows d
JOIN one_rel_pairs o
  ON o.person_id = d.person_id
 AND o.related_person_id = d.related_person_id
WHERE (d.person_id, d.related_person_id) NOT IN (
    ('Q115601274','Q259998'),
    ('Q6377498','Q38222'),
    ('Q4739681','Q38222'),
    ('Q13147738','Q13909')
);


-------------------- {core.personaward} ---------------------
-- OWNER: <Xiang>
-- SOURCE: raw.peopleaward
-- DEPENDS ON: core.person, core.award

DROP TABLE IF EXISTS core.personaward CASCADE;

CREATE TABLE core.personaward (
    person_id VARCHAR(50) NOT NULL,
    award_id  VARCHAR(50) NOT NULL,
    year      SMALLINT,
    type      VARCHAR(50),
    PRIMARY KEY (person_id, award_id, year),
    FOREIGN KEY (person_id) REFERENCES core.person(person_id),
    FOREIGN KEY (award_id)  REFERENCES core.award(award_id)
);

--  Index

CREATE INDEX idx_personAward_type
  ON core.personaward(type);

--  Load

INSERT INTO core.personaward (person_id, award_id, year, type)

WITH base AS (
    SELECT
        TRIM(person_wikiid) AS person_id,
        TRIM(award_wikiid)  AS award_id,
        CASE
          WHEN TRIM(award_year) ~ '^\d{4}\.0$'
            THEN SPLIT_PART(TRIM(award_year), '.', 1)::SMALLINT
          WHEN TRIM(award_year) ~ '^\d{3}\.0$'
            THEN (SPLIT_PART(TRIM(award_year), '.', 1) || '2')::SMALLINT
          ELSE 0
        END AS year,

        CASE
            WHEN LOWER(TRIM(type)) = 'award' THEN 'Award'
            WHEN LOWER(TRIM(type)) = 'nomination' THEN 'Nomination'
            ELSE NULL
        END AS type
    FROM raw.peopleaward
    WHERE person_wikiid IS NOT NULL
      AND award_wikiid  IS NOT NULL
),

dedup AS (
    SELECT DISTINCT person_id, award_id, year, type
    FROM base
),

picked AS (
    SELECT
        person_id,
        award_id,
        year,
        type,
        ROW_NUMBER() OVER (
            PARTITION BY person_id, award_id, year
            ORDER BY CASE WHEN type = 'Award' THEN 0 ELSE 1 END
        ) AS rn
    FROM dedup
    WHERE EXISTS (SELECT 1 FROM core.person p WHERE p.person_id = dedup.person_id)
      AND EXISTS (SELECT 1 FROM core.award  a WHERE a.award_id  = dedup.award_id)
)
SELECT
    person_id,
    award_id,
    year,
    type
FROM picked
WHERE rn = 1 AND year != 2069;



-------------------- {core.principal} ---------------------
-- OWNER: Hangjin
-- SOURCE: raw.principal
-- DEPENDS ON: (none)

CREATE SCHEMA IF NOT EXISTS core;

-- Create Core Table
DROP TABLE IF EXISTS core.principal;

CREATE TABLE core.principal (
    tconst               VARCHAR(10) NOT NULL,
    ordering             INT NOT NULL,
    nconst               VARCHAR(11) NOT NULL,
    category             VARCHAR(20) NOT NULL,
    PRIMARY KEY (tconst, ordering),
    FOREIGN KEY (tconst) REFERENCES core.title (tconst)
    -- created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
);


-- Load
-- Original data is clean. No NULL or unexpected data.
INSERT INTO core.principal (
    tconst,
    ordering,
    nconst,
    category
)
SELECT
    p.tconst,
    ordering,
    nconst,
    category
FROM raw.principal p
JOIN core.title t
ON p.tconst = t.tconst;
-- ON CONFLICT (tconst, ordering)
-- DO UPDATE SET
--     updated_at = NOW();

-------------------- {core.movieaward} ---------------------
-- OWNER: <Hangjin>
-- SOURCE: raw.movieaward
-- DEPENDS ON: core.title, core.person

DROP TABLE IF EXISTS core.movieaward CASCADE;

CREATE TABLE IF NOT EXISTS core.movieaward (
    movie_id       VARCHAR(11),
    award_id       VARCHAR(11),
    type           VARCHAR(11),
    tconst         VARCHAR(10),
    year           SMALLINT,
    -- created_at     TIMESTAMPTZ DEFAULT NOW(),
    -- updated_at     TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (movie_id, award_id),
    FOREIGN KEY (tconst) REFERENCES core.title(tconst),
    FOREIGN KEY (award_id) REFERENCES core.award(award_id)
);

-- Index for performance on joins
CREATE INDEX IF NOT EXISTS idx_movie_award_tconst ON core.movieaward (tconst);

INSERT INTO core.movieaward (movie_id, award_id, year, type, tconst)

WITH base AS (
    SELECT
        TRIM(film_wikiid) AS movie_id,
        TRIM(award_wikiid) AS award_id,
        CASE
          WHEN TRIM(award_year) ~ '^\d{4}\.0$'
            THEN SPLIT_PART(TRIM(award_year), '.', 1)::SMALLINT
          ELSE 0
        END AS year,

        CASE
            WHEN LOWER(TRIM(type)) = 'award' THEN 'Award'
            WHEN LOWER(TRIM(type)) = 'nomination' THEN 'Nomination'
            ELSE NULL
        END AS type,
        imdb_id AS tconst
    FROM raw.movieaward
    WHERE film_wikiid  IS NOT NULL
      AND award_wikiid  IS NOT NULL
      AND LENGTH(award_wikiid) < 15
),

dedup AS (
    SELECT DISTINCT movie_id, award_id, year, type, tconst
    FROM base
),

picked AS (
    SELECT
        movie_id,
        award_id,
        year,
        type,
        tconst,
        ROW_NUMBER() OVER (
            PARTITION BY movie_id, award_id
            ORDER BY CASE WHEN type = 'Award' THEN 0 ELSE 1 END,
            year DESC
        ) AS rn
    FROM dedup
    WHERE EXISTS (SELECT 1 FROM core.title t WHERE t.tconst = dedup.tconst)
      AND EXISTS (SELECT 1 FROM core.award a WHERE a.award_id  = dedup.award_id)
)
SELECT
    movie_id,
    award_id,
    year,
    type,
    tconst
FROM picked
WHERE rn = 1;

-------------------- {core.rating} ---------------------
-- OWNER: Emma
-- SOURCE: raw.rating
-- DEPENDS ON: core.title (tconst)

DROP TABLE IF EXISTS core.rating CASCADE;

CREATE TABLE IF NOT EXISTS core.rating (
tconst VARCHAR(10) PRIMARY KEY,
average_rating NUMERIC(3,1) NOT NULL,
num_votes INTEGER NOT NULL,
-- created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
-- updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
CONSTRAINT fk_title_rating_tconst
FOREIGN KEY (tconst) REFERENCES core.title (tconst)
);

-- Indexes (PK already indexes tconst; keep num_votes for common ranking/filtering)
CREATE INDEX IF NOT EXISTS idx_title_rating_num_votes
ON core.rating (num_votes);

CREATE INDEX IF NOT EXISTS idx_title_rating_average_rating
ON core.rating (average_rating);

-- Load
INSERT INTO core.rating (
    tconst,
    average_rating,
    num_votes
)
SELECT
    TRIM(r.tconst),
    NULLIF(TRIM(r.averageRating), '')::NUMERIC,
    NULLIF(TRIM(r.numVotes), '')::INTEGER
FROM raw.rating r
WHERE r.tconst IS NOT NULL
  AND TRIM(r.tconst) ~ '^tt[0-9]+$'
  AND NULLIF(TRIM(r.averageRating), '') IS NOT NULL
  AND NULLIF(TRIM(r.numVotes), '') IS NOT NULL
  AND EXISTS (
      SELECT 1
      FROM core.title t
      WHERE t.tconst = TRIM(r.tconst)
  );




/**************************************************************
 ABOVE IS - SECTION 1 — CORE TABLES + LOAD
 **************************************************************/



/* ============================================================
   SECTION 2 — ERR / DATA QUALITY VIEWS (OPTIONAL)
   ------------------------------------------------------------
   Put “problem-finding” views here so everyone can run them.
   Name convention: err.vw_<topic>
   ============================================================ */
-------------------- {err.vw_person_rejects} ---------------------
-- OWNER: Emma
-- SOURCE: raw.person
-- NOTE: Adds reject_reason + reject_code so each failed row is tagged.

CREATE OR REPLACE VIEW err.vw_person_rejects AS
WITH base AS (
    SELECT
        p.*,
        substring(trim(p.person) from '(Q[0-9]+)') AS extracted_person_id,
        trim(p.person)     AS person_raw,
        trim(p.name)       AS name_raw,
        trim(p.birthDate)  AS birthdate_raw,
        trim(p.gender)     AS gender_raw
    FROM raw.person p
),
parsed AS (
    SELECT
        b.*,
        -- parse birthdate only if it matches allowed patterns
        CASE
            WHEN b.birthdate_raw IS NULL OR b.birthdate_raw = '' THEN NULL
            WHEN b.birthdate_raw ~ '^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$'
                THEN b.birthdate_raw::timestamptz::date
            ELSE NULL
        END AS birthdate_parsed,
        -- validity flags
        (b.person_raw IS NOT NULL AND b.extracted_person_id IS NOT NULL AND b.extracted_person_id ~ '^Q[0-9]+$') AS ok_person_qid,
        (NULLIF(b.name_raw, '') IS NOT NULL)                                                                    AS ok_name,
        (
            NOT (
                b.birthdate_raw IS NOT NULL AND b.birthdate_raw <> '' AND
                NOT (b.birthdate_raw ~ '^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$')
            )
        ) AS ok_birthdate_format,
        (
            NOT (
                b.gender_raw IS NOT NULL AND b.gender_raw <> '' AND lower(b.gender_raw) LIKE 'http%'
            )
        ) AS ok_gender
    FROM base b
),
dupes AS (
    -- Identify rows that are NOT the chosen winner for a person_id (earliest birthdate wins)
    SELECT
        p.*,
        ROW_NUMBER() OVER (
            PARTITION BY p.extracted_person_id
            ORDER BY
                p.birthdate_parsed NULLS LAST,   -- earliest non-null birthdate wins
                (p.IMDb IS NULL),                -- prefer having IMDb/nconst
                p.IMDb,
                p.name_raw,
                p.gender_raw
        ) AS rn
    FROM parsed p
),
tagged AS (
    SELECT
        d.*,
        CASE
            -- 1) person not match Q\d+ (cannot extract proper QID)
            WHEN NOT d.ok_person_qid THEN '1. person id is missing or not Q[0-9]+'

            -- 2) missing required name
            WHEN NOT d.ok_name THEN '2. name is missing'

            -- 3) birthDate exists but does not match allowed date/timestamp pattern
            WHEN NOT d.ok_birthdate_format THEN '3. birthDate is not a valid date/timestamp'

            -- 4) gender looks like a URI
            WHEN NOT d.ok_gender THEN '4. gender looks like a URI (http...)'

            -- 5) duplicate person rows: not the selected winner (keep earliest birthdate)
            WHEN d.extracted_person_id IS NOT NULL AND d.rn > 1 THEN
                 '5. duplicate person_id; kept rn=1 (earliest birthdate preferred)'

            -- 6) everything looks valid but still not loaded to core (other reasons)
            WHEN NOT EXISTS (
                SELECT 1
                FROM core.person c
                WHERE c.person_id = d.extracted_person_id
            ) THEN '6. not present in core.person after load (unexpected)'

            ELSE '0. passed filters (should not appear)'
        END AS reject_reason,
        CASE
            WHEN NOT d.ok_person_qid THEN 1
            WHEN NOT d.ok_name THEN 2
            WHEN NOT d.ok_birthdate_format THEN 3
            WHEN NOT d.ok_gender THEN 4
            WHEN d.extracted_person_id IS NOT NULL AND d.rn > 1 THEN 5
            WHEN NOT EXISTS (
                SELECT 1
                FROM core.person c
                WHERE c.person_id = d.extracted_person_id
            ) THEN 6
            ELSE 0
        END AS reject_code
    FROM dupes d
)
SELECT
    -- original raw columns only
    t.person,
    t.name,
    t.gender,
    t.birthDate,
    t.IMDb,

    -- helper extracted fields
    t.extracted_person_id AS person_id_extracted,
    t.birthdate_parsed,

    -- tagging
    t.reject_code,
    t.reject_reason
FROM tagged t
WHERE t.reject_code <> 0;


-------------------- {err.vw_award_rejects} ---------------------
-- OWNER: <Emma>
-- SOURCE: raw.movieaward + raw.peopleaward
-- PURPOSE: Tag rows excluded from core.award load

CREATE OR REPLACE VIEW err.vw_award_rejects AS
WITH unioned AS (
    SELECT
        'raw.movieaward'::text AS source_table,
        TRIM(award_wikiid) AS award_id_raw,
        TRIM(award_name)   AS name_raw
    FROM raw.movieaward

    UNION ALL

    SELECT
        'raw.peopleaward'::text AS source_table,
        TRIM(award_wikiid) AS award_id_raw,
        TRIM(award_name)   AS name_raw
    FROM raw.peopleaward
),
tagged AS (
    SELECT
        u.*,
        NULLIF(u.award_id_raw, '') AS award_id,
        NULLIF(u.name_raw, '')     AS name,
        CASE
            WHEN NULLIF(u.award_id_raw, '') IS NULL THEN 1
            WHEN u.award_id_raw !~ '^Q[0-9]+$' THEN 2
            WHEN NULLIF(u.name_raw, '') IS NULL THEN 3
            WHEN NOT EXISTS (
                SELECT 1
                FROM core.award a
                WHERE a.award_id = u.award_id_raw
            ) THEN 4
            ELSE 0
        END AS reject_code,
        CASE
            WHEN NULLIF(u.award_id_raw, '') IS NULL
                THEN '1. award_id missing/blank'
            WHEN u.award_id_raw !~ '^Q[0-9]+$'
                THEN '2. award_id not valid QID'
            WHEN NULLIF(u.name_raw, '') IS NULL
                THEN '3. award_name missing/blank'
            WHEN NOT EXISTS (
                SELECT 1
                FROM core.award a
                WHERE a.award_id = u.award_id_raw
            )
                THEN '4. not loaded into core.award (unexpected)'
            ELSE '0. ok'
        END AS reject_reason
    FROM unioned u
)
SELECT
    source_table,
    award_id_raw,
    name_raw,
    reject_code,
    reject_reason
FROM tagged
WHERE reject_code <> 0;


-------------------- {err.vw_title_tconst_duplicate_or_missing} ---------------------
-- OWNER: <Bryan>
-- SOURCE: raw.title
-------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW err.vw_title_tconst_duplicate_or_missing AS
WITH duplicate AS (
    SELECT
        tconst,
        COUNT(*) AS dup_count
    FROM raw.title
    WHERE tconst IS NOT NULL
    GROUP BY tconst
    HAVING COUNT(*) > 1
),
missing AS (
    SELECT
        NULL::text AS tconst,
        COUNT(*) AS dup_count
    FROM raw.title
    WHERE tconst IS NULL OR TRIM(tconst) = ''
)
SELECT d.tconst, d.dup_count, NOW() AS detected_at
FROM duplicate d
UNION ALL
SELECT m.tconst, m.dup_count, NOW() AS detected_at
FROM missing m
ORDER BY dup_count DESC, tconst ASC;


-------------------- {err.vw_title_primary_title_duplicate} ---------------------
-- OWNER: <Bryan>
-- SOURCE: core.title
-------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS err;

CREATE OR REPLACE VIEW err.vw_title_primary_title_duplicate AS
SELECT
    t.tconst,
    t.primary_title,
    cnt.dup_count,
    NOW() AS detected_at
FROM core.title t JOIN (
    SELECT
        t.primary_title,
        COUNT(*) AS dup_count
    FROM core.title AS t
    WHERE t.primary_title IS NOT NULL
    GROUP BY t.primary_title
    HAVING COUNT(*) > 1
) cnt
    ON t.primary_title = cnt.primary_title
ORDER BY cnt.dup_count DESC, t.primary_title, t.tconst;


-------------------- {err.vw_title_missing_primary_title} ---------------------
-- OWNER: <Bryan>
-- SOURCE: core.title
-------------------------------------------------------------------------------
CREATE OR REPLACE VIEW err.vw_title_missing_primary_title AS
SELECT
    tconst,
    primary_title,
    NOW() AS detected_at
FROM core.title
WHERE primary_title IS NULL OR primary_title = '';


-------------------- {err.vw_title_missing_start_year} ---------------------
-- OWNER: <Bryan>
-- SOURCE: core.title
----------------------------------------------------------------------------
CREATE OR REPLACE VIEW err.vw_title_missing_start_year AS
SELECT
    tconst,
    primary_title,
    start_year,
    NOW() AS detected_at
FROM core.title
WHERE start_year IS NULL;

-------------------- {err.vw_title_missing_end_year} ---------------------
-- OWNER: <Bryan>
-- SOURCE: core.title
--------------------------------------------------------------------------
CREATE OR REPLACE VIEW err.vw_title_missing_end_year AS
SELECT
    tconst,
    primary_title,
    end_year,
    NOW() AS detected_at
FROM core.title
WHERE end_year IS NULL;


-------------------- {err.vw_title_missing_genres} ---------------------
-- OWNER: <Bryan>
-- SOURCE: raw.title
------------------------------------------------------------------------
CREATE OR REPLACE VIEW err.vw_title_missing_genres AS
SELECT
    t.tconst            AS tconst,
    t.primaryTitle      AS primary_title,
    t.genres            AS genres,
    NOW()               AS detected_at
FROM raw.title t
WHERE NULLIF(TRIM(t.genres), '') IS NULL OR array_length( regexp_split_to_array( TRIM(t.genres), '\s*,\s*' ), 1 ) = 0;


-------------------- {err.vw_peopleaward_invalid_award_year} ---------------------

-- OWNER: <Xiang>
-- SOURCE: raw.peopleaward

CREATE OR REPLACE VIEW err.vw_peopleaward_invalid_award_year AS

SELECT rp.*
FROM raw.peopleaward rp
WHERE rp.award_year IS NOT NULL
  AND TRIM(rp.award_year) <> ''
  AND (
        -- invalid format
        NOT (
            TRIM(rp.award_year) ~ '^\d{4}$'
         OR TRIM(rp.award_year) ~ '^\d{4}\.0$'
         OR TRIM(rp.award_year) ~ '^\d{3}\.0$'
        )

        -- OR valid format but year > 2026
        OR (
            CASE
              WHEN TRIM(rp.award_year) ~ '^\d{4}$'
                THEN TRIM(rp.award_year)::INT
              WHEN TRIM(rp.award_year) ~ '^\d{4}\.0$'
                THEN SPLIT_PART(TRIM(rp.award_year), '.', 1)::INT
              WHEN TRIM(rp.award_year) ~ '^\d{3}\.0$'
                THEN (SPLIT_PART(TRIM(rp.award_year), '.', 1) || '2')::INT
              ELSE NULL
            END > 2026
        )
      );

-------------------- {err.vw_peopleaward_invalid_ids_or_fk} ---------------------
-- OWNER: <Xiang>
-- SOURCE: raw.peopleaward

CREATE OR REPLACE VIEW err.vw_peopleaward_invalid_ids_or_fk AS
WITH base AS (
    SELECT
        rp.*,
        TRIM(rp.person_wikiid) AS person_id,
        TRIM(rp.award_wikiid)  AS award_id
    FROM raw.peopleaward rp
)
SELECT b.*
FROM base b
WHERE
      b.person_wikiid IS NULL
   OR b.award_wikiid  IS NULL
   OR NOT EXISTS (SELECT 1 FROM core.person p WHERE p.person_id = b.person_id)
   OR NOT EXISTS (SELECT 1 FROM core.award  a WHERE a.award_id  = b.award_id);

-------------------- {err.vw_peopleaward_dropped_nom_when_award_exists} ---------------------
-- OWNER: <Xiang>
-- SOURCE: raw.peopleaward

CREATE OR REPLACE VIEW err.vw_peopleaward_dropped_nom_when_award_exists AS
SELECT rp.*
FROM raw.peopleaward rp
WHERE LOWER(TRIM(rp.type)) = 'nomination'
  AND rp.person_wikiid IS NOT NULL
  AND rp.award_wikiid  IS NOT NULL
  AND rp.award_year    IS NOT NULL
  AND EXISTS (
      SELECT 1
      FROM raw.peopleaward r2
      WHERE r2.person_wikiid = rp.person_wikiid
        AND r2.award_wikiid  = rp.award_wikiid
        AND r2.award_year    = rp.award_year
        AND LOWER(TRIM(r2.type)) = 'award'
  );

-------------------- {err.vw_parent_invalid_ids} ---------------------------------
-- OWNER: <Xiang>
-- SOURCE: raw.parent
-------------------------------------------------------------------------------

CREATE OR REPLACE VIEW err.vw_parent_invalid_ids AS
SELECT *
FROM raw.parent p
WHERE regexp_replace(TRIM(p.personid), '^.*/(Q\d+)$', '\1', 'i') !~ '^Q\d+$'
    OR ( p.fatherid IS NOT NULL AND regexp_replace(TRIM(p.fatherid), '^.*/(Q\d+)$', '\1', 'i') !~ '^Q\d+$' )
   OR ( p.motherid IS NOT NULL AND regexp_replace(TRIM(p.motherid), '^.*/(Q\d+)$', '\1', 'i') !~ '^Q\d+$' );

-------------------- {err.vw_parent_multi_father_or_mother} ---------------------
-- OWNER: <Xiang>
-- SOURCE: raw.parent
-------------------------------------------------------------------------------

CREATE OR REPLACE VIEW err.vw_parent_multi_father_or_mother AS
SELECT *
FROM raw.parent p
WHERE p.personid IN (

    -- persons with multiple distinct fathers
    SELECT personid
    FROM raw.parent
    WHERE fatherid IS NOT NULL
    GROUP BY personid
    HAVING COUNT(DISTINCT fatherid) > 1

    UNION

    -- persons with multiple distinct mothers
    SELECT personid
    FROM raw.parent
    WHERE motherid IS NOT NULL
    GROUP BY personid
    HAVING COUNT(DISTINCT motherid) > 1
);

-------------------- {err.vw_relative_invalid_ids} ---------------------
-- OWNER: <Xiang>
-- SOURCE: raw.relative
---------------------------------------------------------------------

CREATE OR REPLACE VIEW err.vw_relative_invalid_ids AS
SELECT *
FROM raw.relative r
WHERE
      r.personid IS NULL
   OR r.relativeid IS NULL
   OR TRIM(r.personid)  !~ '^Q\d+$'
   OR TRIM(r.relativeid) !~ '^Q\d+$';

-------------------- {err.vw_relative_duplicate_pairs} ---------------------
-- OWNER: <Xiang>
-- SOURCE: raw.relative
-------------------------------------------------------------------------

CREATE OR REPLACE VIEW err.vw_relative_duplicate_pairs AS
SELECT *
FROM raw.relative r
WHERE (r.personid, r.relativeid) IN (
    SELECT personid, relativeid
    FROM raw.relative
    GROUP BY personid, relativeid
    HAVING COUNT(*) > 1
)
ORDER BY r.personid, r.relativeid;

-------------------- {err.vw_relative_pairs_also_in_parent} ---------------------
-- OWNER: <Xiang>
-- SOURCE: raw.relative + raw.parent
------------------------------------------------------------------------------

CREATE OR REPLACE VIEW err.vw_relative_pairs_also_in_parent AS
SELECT r.*
FROM raw.relative r
WHERE
  r.personid IS NOT NULL
  AND r.relativeid IS NOT NULL
  AND (TRIM(r.personid), TRIM(r.relativeid)) IN (

      SELECT
        regexp_replace(TRIM(p.personid), '^.*/(Q\d+)$', '\1', 'i') AS person_id,
        regexp_replace(TRIM(p.fatherid), '^.*/(Q\d+)$', '\1', 'i') AS related_person_id
      FROM raw.parent p
      WHERE p.fatherid IS NOT NULL

      UNION

      SELECT
        regexp_replace(TRIM(p.personid), '^.*/(Q\d+)$', '\1', 'i') AS person_id,
        regexp_replace(TRIM(p.motherid), '^.*/(Q\d+)$', '\1', 'i') AS related_person_id
      FROM raw.parent p
      WHERE p.motherid IS NOT NULL
  )
ORDER BY TRIM(r.personid), TRIM(r.relativeid);

-------------------- {err.vw_principal_invalid_tconst} ---------------------
-- OWNER: <Hangjin>
-- SOURCE: raw.principal
------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS err;

CREATE OR REPLACE VIEW err.vw_principal_invalid_tconst AS
SELECT
    p.tconst,
    ordering,
    nconst,
    category
FROM raw.principal p
LEFT JOIN core.title t
ON p.tconst = t.tconst
WHERE t.tconst IS NULL;

-------------------- {err.vw_title_rating_rejects} ---------------------
-- OWNER: Emma
-- SOURCE: raw.title

CREATE OR REPLACE VIEW err.vw_title_rating_rejects AS
SELECT *
FROM raw.rating r
WHERE NOT (
    r.tconst IS NOT NULL
    AND TRIM(r.tconst) ~ '^tt[0-9]+$'
    AND NULLIF(TRIM(r.averageRating), '') IS NOT NULL
    AND NULLIF(TRIM(r.numVotes), '') IS NOT NULL
    AND EXISTS (
        SELECT 1
        FROM core.title t
        WHERE t.tconst = TRIM(r.tconst)
    )
);

-------------------- {err.vw_movieaward_invalid_ids_or_fk} ---------------------
-- OWNER: <Hangjin>
-- SOURCE: raw.movieaward

CREATE OR REPLACE VIEW err.vw_movieaward_invalid_ids_or_fk AS
WITH base AS (
    SELECT
        rm.*,
        TRIM(rm.film_wikiid) AS movie_id,
        TRIM(rm.award_wikiid)  AS award_id
    FROM raw.movieaward rm
)
SELECT b.*
FROM base b
WHERE
      b.film_wikiid IS NULL
   OR b.award_wikiid  IS NULL
   OR LENGTH(b.award_wikiid) > 15 ---For 1 record with url istead of real Q id.
   OR NOT EXISTS (SELECT 1 FROM core.title t WHERE t.tconst = b.imdb_id )
   OR NOT EXISTS (SELECT 1 FROM core.award  a WHERE a.award_id  = b.award_id);

-------------------- {err.vw_movieaward_dropped_nom_when_award_exists} ---------------------
-- OWNER: <Hangjin>
-- SOURCE: raw.movieaward

CREATE OR REPLACE VIEW err.movieaward_dropped_nom_when_award_exists AS
SELECT rm.*
FROM raw.movieaward rm
WHERE LOWER(TRIM(rm.type)) = 'nomination'
  AND rm.film_wikiid IS NOT NULL
  AND rm.award_wikiid  IS NOT NULL
  AND rm.imdb_id    IS NOT NULL
  AND EXISTS (
      SELECT 1
      FROM raw.movieaward r2
      WHERE r2.film_wikiid = rm.film_wikiid
        AND r2.award_wikiid  = rm.award_wikiid
        AND LOWER(TRIM(r2.type)) = 'award'
  );
   
/**************************************************************
 ABOVE IS - SECTION 2 — CORE TABLES + LOAD
 **************************************************************/


/* ============================================================
   SECTION 3 — VALIDATION (SELECT ONLY)
   ------------------------------------------------------------
   Keep only SELECTs here so file can be re-run safely.
   ============================================================ */

-------------------- {validation} ---------------------
-- SELECT * FROM err.vw_person_name_birthdate_duplicate;
-- SELECT * FROM err.vw_person_missing_imdb;

-- SELECT COUNT(*) FROM core.person;
-- SELECT * FROM core.person LIMIT 10;
-- SELECT * FROM raw.person LIMIT 10;

SELECT * FROM err.vw_title_tconst_duplicate_or_missing;
SELECT * FROM err.vw_title_primary_title_duplicate;
SELECT * FROM err.vw_title_missing_primary_title;
SELECT * FROM err.vw_title_missing_end_year;
SELECT * FROM err.vw_title_missing_genres;

select * from err.vw_title_rating_rejects;

select * from err.vw_award_rejects;

-------------------- {Data Complition} ---------------------


-------------------- {validation.person_row_reconciliation} ---------------------

SELECT
    (SELECT COUNT(*) FROM raw.person)  AS raw_count,
    (SELECT COUNT(*) FROM core.person) AS core_count,
    (SELECT COUNT(*) FROM err.vw_person_rejects) AS error_count,
    (SELECT COUNT(*) FROM raw.person)
        - (SELECT COUNT(*) FROM core.person)
        - (SELECT COUNT(*) FROM err.vw_person_rejects) AS difference;


-------------------- {validation.person_row_reconciliation} ---------------------

SELECT
    (SELECT COUNT(*) FROM raw.rating)   AS raw_count,
    (SELECT COUNT(*) FROM core.rating)  AS core_count,
    (SELECT COUNT(*) FROM err.vw_title_rating_rejects)   AS error_count,
    (SELECT COUNT(*) FROM raw.rating)
        - (SELECT COUNT(*) FROM core.rating)
        - (SELECT COUNT(*) FROM err.vw_title_rating_rejects) AS difference;


-------------------- {validation.title_row_reconciliation} ---------------------
SELECT
    (SELECT COUNT(*) FROM raw.title)  AS raw_count,
    (SELECT COUNT(*) FROM core.title) AS core_count,
    (SELECT SUM(dup_count) FROM err.vw_title_tconst_duplicate_or_missing) AS error_count,
    (SELECT COUNT(*) FROM raw.title)
        - (SELECT COUNT(*) FROM core.title)
        - (SELECT SUM(dup_count) FROM err.vw_title_tconst_duplicate_or_missing) AS difference;

/**************************************************************
 ABOVE IS - SECTION 3 — VALIDATION (SELECT ONLY)
 **************************************************************/
