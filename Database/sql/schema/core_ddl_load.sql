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
-- SOURCE: raw.person, raw.person_image
-- DEPENDS ON: (none)

DROP TABLE IF EXISTS core.person CASCADE;

CREATE TABLE IF NOT EXISTS core.person (
    person_id   VARCHAR(20) PRIMARY KEY,
    name        VARCHAR(60) NOT NULL,
    gender      VARCHAR(20),
    birthdate   DATE,
    nconst      VARCHAR(12),
    image_url   TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_person_name
    ON core.person (name);

-- Load
INSERT INTO core.person (
    person_id,
    name,
    gender,
    birthdate,
    nconst,
    image_url
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
        END                                                AS nconst,
        NULLIF(TRIM(pi.imageUrl), '')                      AS image_url
    FROM raw.person p
    LEFT JOIN raw.person_image pi
        ON TRIM(pi.person) = TRIM(p.person)
    WHERE p.person IS NOT NULL
      AND NULLIF(TRIM(p.name), '') IS NOT NULL
),
filtered AS (
    SELECT *
    FROM cleaned
    WHERE
        person_id IS NOT NULL
        AND person_id ~ '^Q[0-9]+$'
        AND NOT (
            birthdate_raw IS NOT NULL
            AND birthdate_raw <> ''
            AND birthdate IS NULL
        )
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
        f.image_url,
        ROW_NUMBER() OVER (
            PARTITION BY f.person_id
            ORDER BY
                f.birthdate NULLS LAST,
                (f.nconst IS NULL),
                (f.image_url IS NULL),
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
    nconst,
    image_url
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


-- -- -----------------------------
-- -- spouse: from raw.spouse
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

ON CONFLICT (person_id, related_person_id) DO NOTHING;

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

-------------------- {core.mapkinship } ---------------------
-- OWNER: Emma
-- SOURCE: core.principal
-- DEPENDS ON: 


-- ============================================================
-- core.mapkinship v2
-- Aligned with vector-based kinship labels from core_kinship_v2
--
-- Role of this table:
--   1. Seeds for relationships that CAN be structurally inferred
--      (grandfather, uncle etc.) — used as fallback if parent
--      edges are missing from Wikidata
--   2. Primary source for relationships that CANNOT be inferred
--      from parent edges alone (in-laws, godparents, relatives)
-- ============================================================


DROP TABLE IF EXISTS core.mapkinship CASCADE;


CREATE TABLE IF NOT EXISTS core.mapkinship (
   relationship VARCHAR(100) PRIMARY KEY,
   kinship      VARCHAR(30)  NOT NULL   -- matches v2 labels
);


INSERT INTO core.mapkinship (relationship, kinship) VALUES


-- ── PARENT (gen=+1, deg=0) ────────────────────────────────────────────────
('father',                                        'PARENT'),
('mother',                                        'PARENT'),
('biological father',                             'PARENT'),
('adoptive father',                               'PARENT'),
('adoptive mother',                               'PARENT'),
('adoptive parent',                               'PARENT'),


-- ── GRANDPARENT (gen=+2, deg=0) ───────────────────────────────────────────
('grandfather',                                   'GRANDPARENT'),
('grandmother',                                   'GRANDPARENT'),
('paternal grandfather',                          'GRANDPARENT'),
('paternal grandmother',                          'GRANDPARENT'),
('maternal grandfather',                          'GRANDPARENT'),
('maternal grandmother',                          'GRANDPARENT'),
('grandparent',                                   'GRANDPARENT'),


-- ── ANCESTOR (gen=+3, deg=0) ──────────────────────────────────────────────
('great-grandfather',                             'ANCESTOR'),
('great-grandmother',                             'ANCESTOR'),
('great-great-grandfather',                       'ANCESTOR'),
('great-great-grandmother',                       'ANCESTOR'),
('great-great-grandparent',                       'ANCESTOR'),
('great-great-great-grandfather',                 'ANCESTOR'),
('great-great-great-grandmother',                 'ANCESTOR'),
('maternal great-grandfather',                    'ANCESTOR'),
('maternal great-grandparent',                    'ANCESTOR'),
('paternal great-grandparent',                    'ANCESTOR'),
('paternal grandfather''s father',                'ANCESTOR'),
('father''s father''s father''s father',          'ANCESTOR'),
('father''s father''s father''s mother',          'ANCESTOR'),
('father''s mother''s father',                    'ANCESTOR'),
('mother''s mother''s mother',                    'ANCESTOR'),
('mother''s mother''s father',                    'ANCESTOR'),
('maternal grandfather''s brother',               'ANCESTOR'),
('4th great-grandfather',                         'ANCESTOR'),
('6th great-grandfather',                         'ANCESTOR'),
('15th great-grandparent',                        'ANCESTOR'),
('ancestor',                                      'ANCESTOR'),
('progenitor',                                    'ANCESTOR'),


-- ── SIBLING (gen=0, deg=1) ────────────────────────────────────────────────
('brother',                                       'SIBLING'),
('sister',                                        'SIBLING'),
('half-brother',                                  'SIBLING'),
('half-sister',                                   'SIBLING'),
('twin brother',                                  'SIBLING'),
('elder brother',                                 'SIBLING'),
('younger brother',                               'SIBLING'),
('younger sister',                                'SIBLING'),
('blood brother',                                 'SIBLING'),
('adoptive brother',                              'SIBLING'),
('adoptive sister',                               'SIBLING'),
('paternal half-brother',                         'SIBLING'),
('paternal half-sister',                          'SIBLING'),
('maternal half-brother',                         'SIBLING'),
('maternal half-sister',                          'SIBLING'),
('sibling',                                       'SIBLING'),


-- ── CHILD (gen=-1, deg=0) ─────────────────────────────────────────────────
('son',                                           'CHILD'),
('daughter',                                      'CHILD'),
('adopted son',                                   'CHILD'),
('adopted daughter',                              'CHILD'),
('adopted child',                                 'CHILD'),
('godson',                                        'CHILD'),
('goddaughter',                                   'CHILD'),
('godchild',                                      'CHILD'),
('son of stepfather',                             'CHILD'),


-- ── GRANDCHILD (gen=-2, deg=0) ────────────────────────────────────────────
('grandson',                                      'GRANDCHILD'),
('granddaughter',                                 'GRANDCHILD'),
('grandchild',                                    'GRANDCHILD'),
('stepgrandson',                                  'GRANDCHILD'),
('stepgranddaughter',                             'GRANDCHILD'),


-- ── DESCENDANT (gen<=-3, deg=0) ───────────────────────────────────────────
('great-grandson',                                'DESCENDANT'),
('great-granddaughter',                           'DESCENDANT'),
('great-great-granddaughter',                     'DESCENDANT'),
('son''s son',                                    'DESCENDANT'),
('son''s daughter',                               'DESCENDANT'),
('daughter''s son',                               'DESCENDANT'),
('daughter''s daughter',                          'DESCENDANT'),


-- ── AUNT_UNCLE (gen=+1, deg=1) ────────────────────────────────────────────
('uncle',                                         'AUNT_UNCLE'),
('aunt',                                          'AUNT_UNCLE'),
('father''s brother',                             'AUNT_UNCLE'),
('father''s sister',                              'AUNT_UNCLE'),
('father''s younger brother',                     'AUNT_UNCLE'),
('mother''s brother',                             'AUNT_UNCLE'),
('mother''s sister',                              'AUNT_UNCLE'),
('parent''s brother',                             'AUNT_UNCLE'),
('parent''s sister',                              'AUNT_UNCLE'),
('paternal half-uncle',                           'AUNT_UNCLE'),
('second uncle',                                  'AUNT_UNCLE'),
('second aunt',                                   'AUNT_UNCLE'),


-- ── GREAT_AUNT_UNCLE (gen=+2, deg=1) — NEW in v2 ─────────────────────────
('granduncle',                                    'GREAT_AUNT_UNCLE'),
('grandaunt',                                     'GREAT_AUNT_UNCLE'),
('grandaunt or granduncle',                       'GREAT_AUNT_UNCLE'),
('great-uncle',                                   'GREAT_AUNT_UNCLE'),
('great-aunt',                                    'GREAT_AUNT_UNCLE'),
('great-granduncle',                              'GREAT_AUNT_UNCLE'),
('great-great-granduncle',                        'GREAT_AUNT_UNCLE'),
('paternal great-grandmother',                    'GREAT_AUNT_UNCLE'),  -- legacy mismap


-- ── NIECE_NEPHEW (gen=-1, deg=1) ─────────────────────────────────────────
('nephew',                                        'NIECE_NEPHEW'),
('niece',                                         'NIECE_NEPHEW'),
('fraternal nephew',                              'NIECE_NEPHEW'),
('fraternal niece',                               'NIECE_NEPHEW'),
('sororal nephew',                                'NIECE_NEPHEW'),
('sororal niece',                                 'NIECE_NEPHEW'),
('paternal nephew',                               'NIECE_NEPHEW'),
('maternal nephew',                               'NIECE_NEPHEW'),
('maternal niece',                                'NIECE_NEPHEW'),
('niece-in-law',                                  'NIECE_NEPHEW'),


-- ── GREAT_NIECE_NEPHEW (gen=-2, deg=1) — NEW in v2 ───────────────────────
('great-nephew',                                  'GREAT_NIECE_NEPHEW'),
('great-niece',                                   'GREAT_NIECE_NEPHEW'),
('great-grandniece',                              'GREAT_NIECE_NEPHEW'),
('second nephew',                                 'GREAT_NIECE_NEPHEW'),
('second niece',                                  'GREAT_NIECE_NEPHEW'),


-- ── COUSIN_1ST (gen=0, deg=2) — NEW granular labels in v2 ────────────────
('cousin',                                        'COUSIN_1ST'),
('first cousin',                                  'COUSIN_1ST'),
('male cousin',                                   'COUSIN_1ST'),
('female cousin',                                 'COUSIN_1ST'),
('male first cousin',                             'COUSIN_1ST'),
('female first cousin',                           'COUSIN_1ST'),
('maternal cousin',                               'COUSIN_1ST'),
('paternal cousin',                               'COUSIN_1ST'),
('maternal first cousin',                         'COUSIN_1ST'),
('male paternal parallel cousin',                 'COUSIN_1ST'),
('female paternal parallel cousin',               'COUSIN_1ST'),
('female parallel cousin',                        'COUSIN_1ST'),
('biaojie',                                       'COUSIN_1ST'),
('"child of a sibling aunt or uncle"',            'COUSIN_1ST'),


-- ── COUSIN_1ST_1R (gen=±1, deg=2) ────────────────────────────────────────
('first cousin once removed descending',          'COUSIN_1ST_1R_DOWN'),
('second cousin once removed ascending',          'COUSIN_2ND_1R_UP'),
('second cousin once removed descending',         'COUSIN_2ND_1R_DOWN'),


-- ── COUSIN_2ND (gen=0, deg=3) ─────────────────────────────────────────────
('second cousin',                                 'COUSIN_2ND'),
('male second cousin',                            'COUSIN_2ND'),
('female second cousin',                          'COUSIN_2ND'),


-- ── COUSIN (catch-all for unmapped cousin variants) ───────────────────────
('third cousin',                                  'RELATIVE'),
('fourth cousin',                                 'RELATIVE'),
('sixth cousin 4 times removed descending',       'RELATIVE'),
('cousin-in-law',                                 'RELATIVE'),


-- ── IN-LAWS (not structurally inferable — primary source) ─────────────────
('father-in-law',                                 'PARENT_INLAW'),
('mother-in-law',                                 'PARENT_INLAW'),
('stepfather-in-law',                             'PARENT_INLAW'),
('stepmother-in-law',                             'PARENT_INLAW'),
('grandfather-in-law',                            'PARENT_INLAW'),
('wife''s father',                                'PARENT_INLAW'),
('wife''s mother',                                'PARENT_INLAW'),
('husband''s father',                             'PARENT_INLAW'),
('husband''s mother',                             'PARENT_INLAW'),
('son-in-law',                                    'CHILD_INLAW'),
('daughter-in-law',                               'CHILD_INLAW'),
('child-in-law',                                  'CHILD_INLAW'),
('brother-in-law',                                'SIBLING_INLAW'),
('sister-in-law',                                 'SIBLING_INLAW'),
('sibling-in-law',                                'SIBLING_INLAW'),
('brother''s wife',                               'SIBLING_INLAW'),
('sister''s husband',                             'SIBLING_INLAW'),
('husband''s brother',                            'SIBLING_INLAW'),
('husband''s sister',                             'SIBLING_INLAW'),
('wife''s sister',                                'SIBLING_INLAW'),
('husband of sister of husband',                  'SIBLING_INLAW'),
('co-brother-in-law',                             'SIBLING_INLAW'),
('wife of mother''s brother',                     'RELATIVE_INLAW'),
('husband of father''s sister',                   'RELATIVE_INLAW'),
('spouse''s uncle',                               'RELATIVE_INLAW'),
('spouse''s aunt',                                'RELATIVE_INLAW'),
('fiancé',                                        'RELATIVE_INLAW'),


-- ── RELATIVE (catch-all) ──────────────────────────────────────────────────
('godfather',                                     'RELATIVE'),
('godmother',                                     'RELATIVE'),
('nurture kinship',                               'RELATIVE'),
('distant relative',                              'RELATIVE'),
('relative',                                      'RELATIVE'),


-- ── SPOUSE (used to infer step-relationships) ───────────────────────────
('spouse',                                        'SPOUSE'),
('wife',                                          'SPOUSE'),
('husband',                                       'SPOUSE'),
('partner',                                       'SPOUSE'),
('ex-wife',                                       'SPOUSE'),
('ex-husband',                                    'SPOUSE'),
('ex-spouse',                                     'SPOUSE'),
('domestic partner',                              'SPOUSE'),
('civil partner',                                 'SPOUSE'),


-- ── STEPPARENT / STEPCHILD (explicit Wikidata labels) ────────────────────
('stepfather',                                    'STEPPARENT'),
('stepmother',                                    'STEPPARENT'),
('stepson',                                       'STEPCHILD'),
('stepdaughter',                                  'STEPCHILD'),
('stepchild',                                     'STEPCHILD'),
('stepbrother',                                   'STEPSIBLING'),
('stepsister',                                    'STEPSIBLING'),


-- ── UNKNOWN (noise / data quality issues) ────────────────────────────────
('witness',                                       'UNKNOWN'),
('first course',                                  'UNKNOWN'),
('q111323925',                                    'UNKNOWN'),
('q10082309',                                     'UNKNOWN');





-------------------- {core.kinship } ---------------------
-- OWNER: Emma
-- SOURCE: core.relationship
-- DEPENDS ON: core.mapkinship
-- ============================================================
-- core.kinship v2 — Vector-based kinship inference
-- Fixed: split recursive CTE into separate up/lateral/down passes
-- ============================================================




-- ============================================================
-- STEP 1: parent edges
-- ============================================================
DROP TABLE IF EXISTS tmp_parent_edges;
CREATE TEMP TABLE tmp_parent_edges AS
SELECT
   r.person_id,
   r.related_person_id AS parent_id
FROM core.relationship r
JOIN core.mapkinship mk ON r.relationship = mk.relationship
WHERE mk.kinship = 'PARENT';


CREATE INDEX idx_v2_pe_person ON tmp_parent_edges (person_id);
CREATE INDEX idx_v2_pe_parent ON tmp_parent_edges (parent_id);




-- ============================================================
-- STEP 2: ancestor chain (go UP only, max depth 5)
-- Produces rows: (person_id, ancestor_id, up_steps)
-- ============================================================
DROP TABLE IF EXISTS tmp_up_chain;
CREATE TEMP TABLE tmp_up_chain AS
WITH RECURSIVE up_cte AS (
   SELECT person_id, parent_id AS ancestor_id, 1 AS up_steps
   FROM tmp_parent_edges


   UNION ALL


   SELECT u.person_id, pe.parent_id AS ancestor_id, u.up_steps + 1
   FROM up_cte u
   JOIN tmp_parent_edges pe ON pe.person_id = u.ancestor_id
   WHERE u.up_steps < 5
)
SELECT DISTINCT person_id, ancestor_id, up_steps FROM up_cte;


CREATE INDEX idx_v2_uc_person   ON tmp_up_chain (person_id);
CREATE INDEX idx_v2_uc_ancestor ON tmp_up_chain (ancestor_id);
CREATE INDEX idx_v2_uc_steps    ON tmp_up_chain (up_steps);




-- ============================================================
-- STEP 3: lateral edges
-- Two people are lateral (sibling) if they:
--   (a) share at least one direct parent in tmp_parent_edges, OR
--   (b) have an explicit sibling relationship in core.relationship
--       (covers cases where shared parents aren't in the DB)
-- ============================================================
DROP TABLE IF EXISTS tmp_lateral_edges;
CREATE TEMP TABLE tmp_lateral_edges AS


-- (a) structurally inferred: share a parent
SELECT DISTINCT
   p1.person_id    AS person_id,
   p2.person_id    AS lateral_id
FROM tmp_parent_edges p1
JOIN tmp_parent_edges p2
   ON p1.parent_id  = p2.parent_id
   AND p1.person_id <> p2.person_id


UNION


-- (b) explicit sibling from core.relationship
SELECT DISTINCT
   r.person_id,
   r.related_person_id AS lateral_id
FROM core.relationship r
JOIN core.mapkinship mk ON r.relationship = mk.relationship
WHERE mk.kinship = 'SIBLING';


CREATE INDEX idx_v2_le_person  ON tmp_lateral_edges (person_id);
CREATE INDEX idx_v2_le_lateral ON tmp_lateral_edges (lateral_id);




-- ============================================================
-- STEP 3b: spouse edges
-- Seeded from explicit spouse/partner relationships in core.relationship.
-- Used to infer step-relationships.
-- ============================================================
DROP TABLE IF EXISTS tmp_spouse_edges;
CREATE TEMP TABLE tmp_spouse_edges AS
SELECT DISTINCT
   r.person_id,
   r.related_person_id AS spouse_id
FROM core.relationship r
JOIN core.mapkinship mk ON r.relationship = mk.relationship
WHERE mk.kinship = 'SPOUSE';


-- make it bidirectional
INSERT INTO tmp_spouse_edges (person_id, spouse_id)
SELECT spouse_id, person_id FROM tmp_spouse_edges
ON CONFLICT DO NOTHING;


CREATE INDEX idx_v2_sp_person ON tmp_spouse_edges (person_id);
CREATE INDEX idx_v2_sp_spouse ON tmp_spouse_edges (spouse_id);




-- ============================================================
-- STEP 4: build kinship vectors
--
-- Canonical path: go UP to LCA → go LATERAL → go DOWN
-- Each combination of (up_steps, lat_steps, down_steps) maps
-- to a unique relationship via:
--   gen_delta = up_steps - down_steps
--   degree    = lat_steps
--   lca_gen   = up_steps
--
-- We enumerate all valid combinations:
--   A. Pure vertical:     lat=0, down = 0..up
--   B. Up + lateral:      up=1..5, lat=1..3, down = 0..up+lat
-- ============================================================
DROP TABLE IF EXISTS tmp_kinship_vectors;
CREATE TEMP TABLE tmp_kinship_vectors AS


-- ── A1. Direct ancestors (up only, no lateral, no down) ──────────────────
SELECT
   uc.person_id,
   uc.ancestor_id          AS related_person_id,
   uc.up_steps - 0         AS gen_delta,
   0                       AS degree,
   uc.up_steps             AS lca_gen
FROM tmp_up_chain uc


UNION ALL


-- ── A2. Direct descendants (reverse of ancestors) ────────────────────────
SELECT
   uc.ancestor_id          AS person_id,
   uc.person_id            AS related_person_id,
   0 - uc.up_steps         AS gen_delta,
   0                       AS degree,
   0                       AS lca_gen
FROM tmp_up_chain uc


UNION ALL


-- ── B1. Same-gen lateral: siblings (up=1, lat=1, down=1) ─────────────────
-- person → up 1 → lateral → down 1 → related
SELECT
   le.person_id,
   le.lateral_id           AS related_person_id,
   0                       AS gen_delta,    -- up=1, down=1
   1                       AS degree,
   1                       AS lca_gen
FROM tmp_lateral_edges le


UNION ALL


-- ── B2a. Up + lateral + down via up_chain ───────────────────────────────
-- person goes up u steps, lateral 1 step, then down d steps
-- Both endpoints reachable via tmp_up_chain (cousins, etc.)
SELECT DISTINCT
   uc1.person_id                  AS person_id,
   uc2.person_id                  AS related_person_id,
   (uc1.up_steps - uc2.up_steps)  AS gen_delta,
   1                              AS degree,
   uc1.up_steps                   AS lca_gen
FROM tmp_up_chain uc1
JOIN tmp_lateral_edges le ON le.person_id   = uc1.ancestor_id
JOIN tmp_up_chain uc2     ON uc2.ancestor_id = le.lateral_id
WHERE uc1.person_id <> uc2.person_id
 AND uc1.up_steps <= 4
 AND uc2.up_steps <= 4


UNION ALL


-- ── B2b. Up + lateral (no down): aunt/uncle with no parent data ───────────
-- person goes up u steps to an ancestor, then lateral to a sibling
-- of that ancestor — the sibling IS the related person (down=0).
-- gen_delta = up_steps (went up u, came down 0), degree = 1
SELECT DISTINCT
   uc.person_id                   AS person_id,
   le.lateral_id                  AS related_person_id,
   uc.up_steps                    AS gen_delta,   -- up=u, down=0
   1                              AS degree,
   uc.up_steps                    AS lca_gen
FROM tmp_up_chain uc
JOIN tmp_lateral_edges le ON le.person_id = uc.ancestor_id
WHERE uc.person_id <> le.lateral_id
 AND uc.up_steps <= 4


UNION ALL


-- ── B2b reverse. Lateral's child → person (NIECE_NEPHEW with no parent data)
-- Bentley→Grace: lateral_id's descendant sees person as niece/nephew target
-- gen_delta = -up_steps (went up 0, effectively down u), degree = 1
SELECT DISTINCT
   le.lateral_id                  AS person_id,
   uc.person_id                   AS related_person_id,
   0 - uc.up_steps                AS gen_delta,   -- down=u, up=0
   1                              AS degree,
   uc.up_steps                    AS lca_gen
FROM tmp_up_chain uc
JOIN tmp_lateral_edges le ON le.person_id = uc.ancestor_id
WHERE uc.person_id <> le.lateral_id
 AND uc.up_steps <= 4


UNION ALL


-- ── B3a. Two lateral hops + down via up_chain (2nd cousins) ─────────────
SELECT DISTINCT
   uc1.person_id                  AS person_id,
   uc2.person_id                  AS related_person_id,
   (uc1.up_steps - uc2.up_steps)  AS gen_delta,
   2                              AS degree,
   uc1.up_steps                   AS lca_gen
FROM tmp_up_chain uc1
JOIN tmp_lateral_edges le1 ON le1.person_id   = uc1.ancestor_id
JOIN tmp_lateral_edges le2 ON le2.person_id   = le1.lateral_id
                          AND le2.lateral_id <> uc1.ancestor_id
JOIN tmp_up_chain uc2      ON uc2.ancestor_id = le2.lateral_id
WHERE uc1.person_id <> uc2.person_id
 AND uc1.up_steps <= 3
 AND uc2.up_steps <= 3


UNION ALL


-- ── B3b. Two lateral hops, no down (cousin with no parent data) ───────────
SELECT DISTINCT
   uc.person_id                   AS person_id,
   le2.lateral_id                 AS related_person_id,
   uc.up_steps                    AS gen_delta,
   2                              AS degree,
   uc.up_steps                    AS lca_gen
FROM tmp_up_chain uc
JOIN tmp_lateral_edges le1 ON le1.person_id   = uc.ancestor_id
JOIN tmp_lateral_edges le2 ON le2.person_id   = le1.lateral_id
                          AND le2.lateral_id <> uc.ancestor_id
WHERE uc.person_id <> le2.lateral_id
 AND uc.up_steps <= 3


UNION ALL


-- ── B3b reverse. Cousin's child → person (cousin once removed, no parent data)
SELECT DISTINCT
   le2.lateral_id                 AS person_id,
   uc.person_id                   AS related_person_id,
   0 - uc.up_steps                AS gen_delta,
   2                              AS degree,
   uc.up_steps                    AS lca_gen
FROM tmp_up_chain uc
JOIN tmp_lateral_edges le1 ON le1.person_id   = uc.ancestor_id
JOIN tmp_lateral_edges le2 ON le2.person_id   = le1.lateral_id
                          AND le2.lateral_id <> uc.ancestor_id
WHERE uc.person_id <> le2.lateral_id
 AND uc.up_steps <= 3


UNION ALL


-- ── S1. Stepparent: person's parent married someone → stepparent ──────────
-- Path: person →(up)→ parent →(spouse)→ stepparent
-- gen_delta = +1, degree = 0, marked via degree=0 but needs label override
-- We use degree=10 as a flag for "step" relationships (not a real geo degree)
SELECT DISTINCT
   uc.person_id                   AS person_id,
   sp.spouse_id                   AS related_person_id,
   uc.up_steps                    AS gen_delta,
   10 + uc.up_steps               AS degree,   -- 10=step flag, +up_steps for gen
   uc.up_steps                    AS lca_gen
FROM tmp_up_chain uc
JOIN tmp_spouse_edges sp ON sp.person_id = uc.ancestor_id
WHERE uc.person_id <> sp.spouse_id
 AND uc.up_steps <= 2            -- stepparent (1) and step-grandparent (2)


UNION ALL


-- ── S1 reverse. Stepchild: stepparent sees person as stepchild ────────────
SELECT DISTINCT
   sp.spouse_id                   AS person_id,
   uc.person_id                   AS related_person_id,
   0 - uc.up_steps                AS gen_delta,
   10 + uc.up_steps               AS degree,
   uc.up_steps                    AS lca_gen
FROM tmp_up_chain uc
JOIN tmp_spouse_edges sp ON sp.person_id = uc.ancestor_id
WHERE uc.person_id <> sp.spouse_id
 AND uc.up_steps <= 2


UNION ALL


-- ── S2. Stepsibling: person's parent's spouse's child ────────────────────
-- Path: person →(up 1)→ parent →(spouse)→ stepparent →(down 1)→ stepsibling
SELECT DISTINCT
   uc1.person_id                  AS person_id,
   uc2.person_id                  AS related_person_id,
   0                              AS gen_delta,   -- same generation
   11                             AS degree,      -- 11 = stepsibling flag
   1                              AS lca_gen
FROM tmp_up_chain uc1
JOIN tmp_spouse_edges sp  ON sp.person_id   = uc1.ancestor_id
JOIN tmp_up_chain uc2     ON uc2.ancestor_id = sp.spouse_id
WHERE uc1.up_steps = 1
 AND uc2.up_steps = 1
 AND uc1.person_id <> uc2.person_id;


CREATE INDEX idx_v2_kv_person  ON tmp_kinship_vectors (person_id);
CREATE INDEX idx_v2_kv_related ON tmp_kinship_vectors (related_person_id);
CREATE INDEX idx_v2_kv_gendeg  ON tmp_kinship_vectors (gen_delta, degree);




-- ============================================================
-- STEP 5: label assignment
-- Pick the closest path per pair, then map (gen_delta, degree)
-- to a kinship label.
-- ============================================================
DROP TABLE IF EXISTS tmp_labeled_kinships;
CREATE TEMP TABLE tmp_labeled_kinships AS
SELECT
   person_id,
   related_person_id,
   gen_delta,
   degree,
   lca_gen,
   CASE
       -- degree 0: direct lineage
       WHEN degree = 0 AND gen_delta =  1 THEN 'PARENT'
       WHEN degree = 0 AND gen_delta = -1 THEN 'CHILD'
       WHEN degree = 0 AND gen_delta =  2 THEN 'GRANDPARENT'
       WHEN degree = 0 AND gen_delta = -2 THEN 'GRANDCHILD'
       WHEN degree = 0 AND gen_delta >=  3 THEN 'ANCESTOR'
       WHEN degree = 0 AND gen_delta <= -3 THEN 'DESCENDANT'


       -- degree 1: sibling line
       WHEN degree = 1 AND gen_delta =  0 THEN 'SIBLING'
       WHEN degree = 1 AND gen_delta =  1 THEN 'AUNT_UNCLE'
       WHEN degree = 1 AND gen_delta = -1 THEN 'NIECE_NEPHEW'
       WHEN degree = 1 AND gen_delta =  2 THEN 'GREAT_AUNT_UNCLE'
       WHEN degree = 1 AND gen_delta = -2 THEN 'GREAT_NIECE_NEPHEW'
       WHEN degree = 1 AND gen_delta >=  3 THEN 'ANCESTOR'
       WHEN degree = 1 AND gen_delta <= -3 THEN 'DESCENDANT'


       -- degree 2: 1st cousins
       WHEN degree = 2 AND gen_delta =  0 THEN 'COUSIN_1ST'
       WHEN degree = 2 AND gen_delta =  1 THEN 'COUSIN_1ST_1R_UP'
       WHEN degree = 2 AND gen_delta = -1 THEN 'COUSIN_1ST_1R_DOWN'
       WHEN degree = 2 AND gen_delta =  2 THEN 'COUSIN_1ST_2R_UP'
       WHEN degree = 2 AND gen_delta = -2 THEN 'COUSIN_1ST_2R_DOWN'
       WHEN degree = 2 AND ABS(gen_delta) >= 3 THEN 'RELATIVE'


       -- degree 3: 2nd cousins (from B3 lateral x2)
       WHEN degree = 3 AND gen_delta =  0 THEN 'COUSIN_2ND'
       WHEN degree = 3 AND gen_delta =  1 THEN 'COUSIN_2ND_1R_UP'
       WHEN degree = 3 AND gen_delta = -1 THEN 'COUSIN_2ND_1R_DOWN'
       WHEN degree = 3 AND ABS(gen_delta) >= 2 THEN 'RELATIVE'


       -- step-relationships (degree 10+ flag)
       WHEN degree = 11                THEN 'STEPSIBLING'
       WHEN degree = 10 AND gen_delta =  1 THEN 'STEPPARENT'
       WHEN degree = 10 AND gen_delta = -1 THEN 'STEPCHILD'
       WHEN degree = 10 AND gen_delta =  2 THEN 'STEP_GRANDPARENT'
       WHEN degree = 10 AND gen_delta = -2 THEN 'STEP_GRANDCHILD'


       ELSE 'RELATIVE'
   END AS kinship
FROM (
   SELECT DISTINCT ON (person_id, related_person_id)
       person_id,
       related_person_id,
       gen_delta,
       degree,
       lca_gen
   FROM tmp_kinship_vectors
   ORDER BY
       person_id,
       related_person_id,
       degree    ASC,
       ABS(gen_delta) ASC,
       lca_gen   ASC
) closest;


CREATE INDEX idx_v2_lk_person  ON tmp_labeled_kinships (person_id);
CREATE INDEX idx_v2_lk_related ON tmp_labeled_kinships (related_person_id);


-- ============================================================
-- STEP 6: explicit non-inferable relationships (in-laws etc.)
-- ============================================================
DROP TABLE IF EXISTS tmp_explicit_kinships;
CREATE TEMP TABLE tmp_explicit_kinships AS
SELECT
   r.person_id,
   r.related_person_id,
   mk.kinship,
   0 AS gen_delta,
   0 AS degree,
   0 AS lca_gen
FROM core.relationship r
JOIN core.mapkinship mk ON r.relationship = mk.relationship
WHERE mk.kinship IN (
   'PARENT_INLAW','CHILD_INLAW','SIBLING_INLAW','RELATIVE_INLAW','RELATIVE',
   'STEPPARENT','STEPCHILD','STEPSIBLING'   -- explicit step-rels override inferred
)
AND NOT EXISTS (
   SELECT 1 FROM tmp_labeled_kinships lk
   WHERE lk.person_id         = r.person_id
     AND lk.related_person_id = r.related_person_id
     AND lk.kinship NOT IN ('RELATIVE')
);


-- ============================================================
-- STEP 7: final insert into core.kinship
-- ============================================================
DROP TABLE IF EXISTS core.kinship CASCADE;


CREATE TABLE core.kinship (
   person_id         VARCHAR(50)  NOT NULL,
   kinship           VARCHAR(30)  NOT NULL,
   related_person_id VARCHAR(50)  NOT NULL,
   gen_delta         SMALLINT,
   degree            SMALLINT,
   lca_gen           SMALLINT,
   PRIMARY KEY (person_id, related_person_id)
);


INSERT INTO core.kinship
   (person_id, kinship, related_person_id, gen_delta, degree, lca_gen)
SELECT person_id, kinship, related_person_id, gen_delta, degree, lca_gen
FROM (
   SELECT
       person_id, kinship, related_person_id, gen_delta, degree, lca_gen,
       ROW_NUMBER() OVER (
           PARTITION BY person_id, related_person_id
           ORDER BY CASE kinship
               WHEN 'PARENT'              THEN 1
               WHEN 'CHILD'               THEN 2
               WHEN 'SIBLING'             THEN 3
               WHEN 'GRANDPARENT'         THEN 4
               WHEN 'GRANDCHILD'          THEN 5
               WHEN 'AUNT_UNCLE'          THEN 6
               WHEN 'NIECE_NEPHEW'        THEN 7
               WHEN 'GREAT_AUNT_UNCLE'    THEN 8
               WHEN 'GREAT_NIECE_NEPHEW'  THEN 9
               WHEN 'COUSIN_1ST'          THEN 10
               WHEN 'COUSIN_1ST_1R_UP'    THEN 11
               WHEN 'COUSIN_1ST_1R_DOWN'  THEN 11
               WHEN 'COUSIN_1ST_2R_UP'    THEN 12
               WHEN 'COUSIN_1ST_2R_DOWN'  THEN 12
               WHEN 'COUSIN_2ND'          THEN 13
               WHEN 'COUSIN_2ND_1R_UP'    THEN 14
               WHEN 'COUSIN_2ND_1R_DOWN'  THEN 14
               WHEN 'ANCESTOR'            THEN 15
               WHEN 'DESCENDANT'          THEN 16
               WHEN 'PARENT_INLAW'        THEN 17
               WHEN 'CHILD_INLAW'         THEN 18
               WHEN 'SIBLING_INLAW'       THEN 19
               WHEN 'RELATIVE_INLAW'      THEN 20
               WHEN 'RELATIVE'            THEN 21
               WHEN 'STEPPARENT'          THEN 22
               WHEN 'STEPCHILD'           THEN 23
               WHEN 'STEPSIBLING'         THEN 24
               WHEN 'STEP_GRANDPARENT'    THEN 25
               WHEN 'STEP_GRANDCHILD'     THEN 26
               ELSE 99
           END
       ) AS rn
   FROM (
       SELECT person_id, kinship, related_person_id, gen_delta, degree, lca_gen
       FROM tmp_labeled_kinships
       UNION ALL
       SELECT person_id, kinship, related_person_id, gen_delta, degree, lca_gen
       FROM tmp_explicit_kinships
   ) combined
   WHERE person_id <> related_person_id
) ranked
WHERE rn = 1;

CREATE INDEX idx_kinship_person_id  ON core.kinship (person_id);
CREATE INDEX idx_kinship_related_id ON core.kinship (related_person_id);
CREATE INDEX idx_kinship_type       ON core.kinship (kinship);
CREATE INDEX idx_kinship_gen_deg    ON core.kinship (gen_delta, degree);

-- ============================================================
-- STEP 8: cleanup
-- ============================================================
DROP TABLE IF EXISTS tmp_parent_edges;
DROP TABLE IF EXISTS tmp_up_chain;
DROP TABLE IF EXISTS tmp_lateral_edges;
DROP TABLE IF EXISTS tmp_spouse_edges;
DROP TABLE IF EXISTS tmp_kinship_vectors;
DROP TABLE IF EXISTS tmp_labeled_kinships;
DROP TABLE IF EXISTS tmp_explicit_kinships;


-- ============================================================
-- VERIFICATION
-- ============================================================
-- SELECT kinship, gen_delta, degree, COUNT(*)
-- FROM core.kinship
-- GROUP BY kinship, gen_delta, degree
-- ORDER BY degree, gen_delta DESC;



-------------------- {core.personpoint} ---------------------
-- OWNER: Hangjin
-- SOURCE: core.movieaward, core.rating, core.principal, core.personaward,core.person
-- DEPENDS ON: 

DROP TABLE IF EXISTS core.personpoint CASCADE;

CREATE TABLE IF NOT EXISTS core.personpoint (
  person_id VARCHAR(20) PRIMARY KEY,
  person_point NUMERIC
);


WITH
-- movieawardscore = (Award×10)+(Nominations×3)
movieawardscore AS (
SELECT
t.tconst,
SUM(CASE WHEN m.type = 'Award' THEN 10
               WHEN m.type = 'Nomination' THEN 3
               ELSE 0 END) AS movie_award_score
FROM core.title t
LEFT JOIN core.movieaward m ON t.tconst = m.tconst
GROUP BY t.tconst
),
-- movie_point = (Log of Rating Count)×(Average Rating) + movieawardscore
moviepoints AS (
SELECT
  t.tconst AS tconst,
  (COALESCE(LOG(r.num_votes), 0) * COALESCE(r.average_rating, 0) +
      movie_award_score) AS movie_point
FROM core.title t
LEFT JOIN core.rating r ON t.tconst = r.tconst
LEFT JOIN movieawardscore mas ON t.tconst = mas.tconst


),
person_movie_point AS (

SELECT
   sub.person_id,
   SUM(((sub.max_ordering + 1.0 - sub.ordering) / sub.max_ordering) * sub.movie_point) AS person_movie_point
FROM (
   SELECT
       p.person_id,
       pr.tconst,
       pr.ordering,
       mp.movie_point,
       MAX(pr.ordering) OVER(PARTITION BY pr.tconst) as max_ordering,
       ROW_NUMBER() OVER(PARTITION BY p.person_id, pr.tconst ORDER BY pr.ordering ASC) as role_rank
   FROM core.person p
   JOIN core.principal pr ON p.nconst = pr.nconst
   JOIN moviepoints mp ON pr.tconst = mp.tconst
) AS sub
WHERE sub.role_rank = 1
GROUP BY sub.person_id
),


person_award_point AS (
SELECT
  p2.person_id,
 SUM(CASE WHEN pa.type = 'Award' THEN 10 ELSE 3 END)  AS person_award_point
FROM core.person p2
JOIN core.personaward pa ON p2.person_id = pa.person_id
GROUP BY p2.person_id
)


INSERT INTO core.personpoint (person_id, person_point)
SELECT
  p.person_id AS person_id,
  (COALESCE(m.person_movie_point, 0) + COALESCE(a.person_award_point, 0)) AS person_point
FROM core.person p
LEFT JOIN person_movie_point m ON p.person_id = m.person_id
LEFT JOIN person_award_point a ON p.person_id = a.person_id;


-------------------- {core.neposcore} ---------------------
-- OWNER: Hangjin
-- SOURCE: 
-- DEPENDS ON: core.kinship, core.personpoint

-- Calculate final nepo score =
-- sum of all relatives' (person_movie_point + person_award_point) * kinship_score
DROP TABLE IF EXISTS core.neposcore CASCADE;


CREATE TABLE IF NOT EXISTS core.neposcore (
   person_id VARCHAR(20) PRIMARY KEY,
   nepo_score NUMERIC
);


INSERT INTO core.neposcore (person_id, nepo_score)
-- Calculate final nepo score =
-- sum of all relatives' (person_point) * kinship_score
SELECT
   k.person_id,
   COALESCE(SUM(
       COALESCE(pp.person_point,0) *
        (CASE
                WHEN k.kinship = 'PARENT' THEN 1
                WHEN k.kinship = 'GRANDPARENT' THEN 0.75
                WHEN k.kinship = 'ANCESTOR' THEN 0.5
                WHEN k.kinship = 'AUNT_UNCLE' THEN 0.5
                WHEN k.kinship = 'GREAT_AUNT_UNCLE' THEN 0.4
                WHEN k.kinship = 'COUSIN_1ST_1R_UP' THEN 0.3
                WHEN k.kinship = 'COUSIN_1ST_2R_UP' THEN 0.2
                WHEN k.kinship = 'COUSIN_2ND_1R_UP' THEN 0.2 
                ELSE 0 END)
                ), 0)
       AS nepo_score
FROM core.kinship k
LEFT JOIN core.personpoint pp ON k.related_person_id = pp.person_id
GROUP BY k.person_id;


-------------------- {core.mv_collaborator_pairs} ---------------------
-- OWNER: Xiang
-- SOURCE: 
-- DEPENDS ON: core.principal

CREATE MATERIALIZED VIEW core.mv_collaborator_pairs AS
SELECT
   p1.tconst,
   p1.nconst AS nconst_1,
   p2.nconst AS nconst_2
FROM core.principal p1
JOIN core.principal p2
 ON p1.tconst = p2.tconst
AND p1.nconst < p2.nconst;


CREATE INDEX idx_mv_collab_tconst
ON core.mv_collaborator_pairs (tconst);


CREATE INDEX idx_mv_collab_nconst1
ON core.mv_collaborator_pairs (nconst_1);


CREATE INDEX idx_mv_collab_nconst2
ON core.mv_collaborator_pairs (nconst_2);

-------------------- {core.mv_relative_collaborator_pairs} ---------------------
-- OWNER: Xiang
-- SOURCE: 
-- DEPENDS ON: core.mv_collaborator_pairs, core.person, core.kinship

CREATE MATERIALIZED VIEW core.mv_relative_collaborator_pairs AS
   SELECT
       cp.tconst,
       p1.person_id AS person_id_1,
       p1.name AS person_name_1,
       p2.person_id AS person_id_2,
       p2.name AS person_name_2,
       k.kinship
   FROM core.mv_collaborator_pairs cp
   JOIN core.person p1
     ON p1.nconst = cp.nconst_1
   JOIN core.person p2
     ON p2.nconst = cp.nconst_2
   JOIN core.kinship k
     ON (k.person_id = p1.person_id AND k.related_person_id = p2.person_id)


   UNION ALL


   SELECT
       cp.tconst,
       p1.person_id AS person_id_1,
       p1.name AS person_name_1,
       p2.person_id AS person_id_2,
       p2.name AS person_name_2,
       k.kinship
   FROM core.mv_collaborator_pairs cp
   JOIN core.person p1
     ON p1.nconst = cp.nconst_1
   JOIN core.person p2
     ON p2.nconst = cp.nconst_2
   JOIN core.kinship k
     ON (k.person_id = p2.person_id AND k.related_person_id = p1.person_id);


CREATE INDEX idx_mv_relative_collaborator_pairs_tconst
ON core.mv_relative_collaborator_pairs (tconst);


-------------------- {core.collaboration} ---------------------
-- OWNER: Bryan
-- SOURCE: 
-- DEPENDS ON: core.principal

CREATE MATERIALIZED VIEW IF NOT EXISTS core.collaboration AS
WITH principal_dedup AS (
   SELECT DISTINCT tconst, nconst
   FROM core.principal
),
pair_counts AS (
   SELECT
       p1.nconst AS person_id,
       p2.nconst AS colleague_id,
       COUNT(*) AS total_collaborations
   FROM principal_dedup p1
       JOIN principal_dedup p2 ON p1.tconst = p2.tconst
   WHERE p1.nconst < p2.nconst
   GROUP BY p1.nconst, p2.nconst
   HAVING COUNT(*) >= 2
)
SELECT person_id, colleague_id, total_collaborations
FROM pair_counts;


CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mv_collab_person
 ON core.collaboration (person_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mv_collab_colleague
 ON core.collaboration (colleague_id);


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
