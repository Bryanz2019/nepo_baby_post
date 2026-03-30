const { Pool, types } = require('pg');
const config = require('./config.json')

// Override the default parsing for BIGINT (PostgreSQL type ID 20)
types.setTypeParser(20, val => parseInt(val, 10));
// // When see a DATE, just return the raw string
// types.setTypeParser(1082, (val) => val);

const connection = new Pool({
  host: config.rds_host,
  user: config.rds_user,
  password: config.rds_password,
  port: config.rds_port,
  database: config.rds_db,
  ssl: config.rds_sslmode === 'require' ? { rejectUnauthorized: false } : false
});
connection.connect((err) => err && console.log(err));


/*************
 * Home page *
 *************/

// Route 1: GET /homepage/top_nepo_babies
const getTopNepoBabies = async function (req, res) {
  connection.query(`
   WITH kinship_agg AS (
    SELECT
        person_id,
        COUNT(DISTINCT CASE WHEN kinship = 'PARENT' THEN related_person_id END) AS parent_count,
        COUNT(DISTINCT CASE WHEN kinship = 'GRANDPARENT' THEN related_person_id END) AS grandparent_count,
        COUNT(DISTINCT CASE
            WHEN kinship NOT IN ('PARENT', 'GRANDPARENT', 'SPOUSE', 'UNKNOWN', 'RELATIVE')
             AND kinship NOT LIKE '%INLAW%'
             AND kinship NOT LIKE 'STEP%'
            THEN related_person_id
        END) AS relative_count
    FROM core.kinship
    GROUP BY person_id
),

base_top_100 AS (
    SELECT
        p.person_id,
        p.nconst,
        p.name,
        EXTRACT(YEAR FROM p.birthdate)::INT AS birth_year,
        COALESCE(
            p.image_url,
            'https://static.wikia.nocookie.net/pbskidsgo/images/5/57/Curious-George.jpg/revision/latest/scale-to-width-down/250?cb=20120712224008'
        ) AS image_url,
        COALESCE(ns.nepo_score, 0) AS nepo_score,
        COALESCE(k.parent_count, 0) AS parent_count,
        COALESCE(k.grandparent_count, 0) AS grandparent_count,
        COALESCE(k.relative_count, 0) AS relative_count
    FROM core.person p
    LEFT JOIN core.neposcore ns
        ON ns.person_id = p.person_id
    LEFT JOIN kinship_agg k
        ON k.person_id = p.person_id
    ORDER BY
        COALESCE(ns.nepo_score, 0) DESC,
        p.person_id
    LIMIT 100
),

principal_base AS (
    SELECT
        b.person_id,
        b.nconst,
        pr.tconst,
        pr.category
    FROM base_top_100 b
    JOIN core.principal pr
        ON pr.nconst = b.nconst
    WHERE pr.category NOT IN ('self', 'archive_footage')
),

title_stats AS (
    SELECT
        pb.nconst,
        COUNT(DISTINCT pb.tconst) AS total_titles,
        AVG(r.average_rating)::NUMERIC(10,2) AS avg_rating,
        MIN(t.start_year) AS career_start_year
    FROM principal_base pb
    LEFT JOIN core.rating r
        ON r.tconst = pb.tconst
    LEFT JOIN core.title t
        ON t.tconst = pb.tconst
    GROUP BY pb.nconst
),

category_counts AS (
    SELECT
        pb.nconst,
        pb.category,
        COUNT(DISTINCT pb.tconst) AS title_count
    FROM principal_base pb
    GROUP BY pb.nconst, pb.category
),

category_ranked AS (
    SELECT
        nconst,
        category,
        title_count,
        ROW_NUMBER() OVER (
            PARTITION BY nconst
            ORDER BY title_count DESC, category
        ) AS rn
    FROM category_counts
),

category_agg AS (
    SELECT
        nconst,
        JSONB_AGG(
            JSONB_BUILD_OBJECT(
                'category', category,
                'title_count', title_count
            )
            ORDER BY title_count DESC, category
        ) AS top_categories
    FROM category_ranked
    WHERE rn <= 3
    GROUP BY nconst
)

SELECT
    b.person_id,
    b.name,
    b.birth_year,
    ts.career_start_year,
    b.image_url,
    b.nepo_score,
    b.parent_count,
    b.grandparent_count,
    b.relative_count,
    COALESCE(ts.total_titles, 0) AS total_titles,
    ts.avg_rating,
    ca.top_categories
FROM base_top_100 b
LEFT JOIN title_stats ts
    ON ts.nconst = b.nconst
LEFT JOIN category_agg ca
    ON ca.nconst = b.nconst
ORDER BY
    b.nepo_score DESC,
    COALESCE(ts.total_titles, 0) DESC,
    b.person_id;
  `, (err, data) => {
    if (err) {
      console.log(err);
      res.json({});
    } else {
      res.json(data.rows);
    }
  });
}

// Route 2: GET /homepage/trending_this_year
const getTrendingThisYear = async function (req, res) {
  connection.query(`
WITH rated_titles_this_year AS (
   SELECT DISTINCT
       p.person_id,
       p.name,
       ns.nepo_score,
       t.tconst,
       t.primary_title,
       r.average_rating,
       r.num_votes


   FROM core.person p
            JOIN core.principal pr      ON pr.nconst    = p.nconst
            JOIN core.title t           ON t.tconst     = pr.tconst
            JOIN core.rating r          ON r.tconst     = t.tconst
            LEFT JOIN core.neposcore ns ON ns.person_id = p.person_id


   WHERE t.start_year >= EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '12 months')::int
     AND t.start_year <= EXTRACT(YEAR FROM CURRENT_DATE)::int
     AND r.average_rating IS NOT NULL
     AND COALESCE(ns.nepo_score, 0) > 0
),


    ranked AS (
        SELECT *,
               ROW_NUMBER() OVER (
                   PARTITION BY person_id
                   ORDER BY average_rating DESC
                   ) AS rn
        FROM rated_titles_this_year
    )


SELECT
   person_id,
   name,
   nepo_score,
   SUM(num_votes)                                              AS total_votes_this_year,
   STRING_AGG(primary_title, ', ' ORDER BY average_rating DESC)
   FILTER (WHERE rn <= 3)                                  AS top_3_titles


FROM ranked
GROUP BY person_id, name, nepo_score
ORDER BY nepo_score        DESC,
        total_votes_this_year DESC
LIMIT 100;
  `, (err, data) => {
    if (err) {
      console.log(err);
      res.json({});
    } else {
      res.json(data.rows);
    }
  });
}

// Route 3: GET /homepage/family_dynasties
const getFamilyDynasties = async function (req, res) {
  connection.query(`
WITH family_dynasty AS (
   SELECT DISTINCT
       CASE
           WHEN SPLIT_PART(TRIM(related.name), ' ', -1) ~* '^(jr\.?|sr\.?|ii|iii|iv|v|vi)$'
               THEN TRIM(SPLIT_PART(TRIM(related.name), ' ', -2))
           ELSE TRIM(SPLIT_PART(TRIM(related.name), ' ', -1))
           END                                               AS dynasty_name,
       k.related_person_id                               AS dynasty_anchor_id
   FROM core.kinship k
            JOIN core.person related ON related.person_id = k.related_person_id
   WHERE k.kinship IN ('PARENT', 'GRANDPARENT')
     AND TRIM(related.name) != ''
),


    dynasty_members AS (
        SELECT
            fd.dynasty_name,
            k.person_id                                       AS member_id
        FROM family_dynasty fd
                 JOIN core.kinship k ON k.related_person_id = fd.dynasty_anchor_id
        WHERE k.kinship IN ('PARENT', 'GRANDPARENT', 'SIBLING',
                            'CHILD', 'GRANDCHILD', 'AUNT_UNCLE',
                            'NIECE_NEPHEW', 'COUSIN_1ST')


        UNION


        SELECT
            fd.dynasty_name,
            fd.dynasty_anchor_id                              AS member_id
        FROM family_dynasty fd
    ),


    dynasty_members_deduped AS (
        SELECT DISTINCT
            dynasty_name,
            member_id
        FROM (
                 SELECT
                     dm.dynasty_name,
                     dm.member_id,
                     CASE
                         WHEN CASE
                                  WHEN SPLIT_PART(TRIM(p.name), ' ', -1) ~* '^(jr\.?|sr\.?|ii|iii|iv|v|vi)$'
                                      THEN TRIM(SPLIT_PART(TRIM(p.name), ' ', -2))
                                  ELSE TRIM(SPLIT_PART(TRIM(p.name), ' ', -1))
                                  END = dm.dynasty_name THEN 1
                         ELSE 2
                         END AS name_match_rank
                 FROM dynasty_members dm
                          JOIN core.person p ON p.person_id = dm.member_id
             ) ranked
        WHERE (member_id, name_match_rank) IN (
            SELECT member_id, MIN(name_match_rank)
            FROM (
                     SELECT
                         dm.dynasty_name,
                         dm.member_id,
                         CASE
                             WHEN CASE
                                      WHEN SPLIT_PART(TRIM(p.name), ' ', -1) ~* '^(jr\.?|sr\.?|ii|iii|iv|v|vi)$'
                                          THEN TRIM(SPLIT_PART(TRIM(p.name), ' ', -2))
                                      ELSE TRIM(SPLIT_PART(TRIM(p.name), ' ', -1))
                                      END = dm.dynasty_name THEN 1
                             ELSE 2
                             END AS name_match_rank
                     FROM dynasty_members dm
                              JOIN core.person p ON p.person_id = dm.member_id
                 ) s
            GROUP BY member_id
        )
    )


SELECT
           ROW_NUMBER() OVER (ORDER BY avg(ns.nepo_score) DESC) AS rank,
           dm.dynasty_name,
           COUNT(DISTINCT dm.member_id)             AS member_count,
           AVG(ns.nepo_score)::NUMERIC(10, 2)       AS avg_nepo_score,
           MAX(ns.nepo_score)                       AS max_nepo_score,
           SUM(ns.nepo_score)                       AS total_nepo_score
FROM dynasty_members_deduped dm
        LEFT JOIN core.neposcore ns ON ns.person_id = dm.member_id
WHERE ns.nepo_score IS NOT NULL
GROUP BY dm.dynasty_name
HAVING COUNT(DISTINCT dm.member_id) >= 2
ORDER BY avg_nepo_score DESC
LIMIT 20;
  `, (err, data) => {
    if (err) {
      console.log(err);
      res.json({});
    } else {
      res.json(data.rows);
    }
  });
}

// Route 4: GET /homepage/surprise_me
const getSurprisePerson = async function (req, res) {
  connection.query(`
  SELECT
    p.person_id,
    p.name,
    p.birthdate,
    ns.nepo_score
  FROM core.person p
          JOIN core.neposcore ns
              ON ns.person_id = p.person_id
  WHERE ns.nepo_score > 0
  ORDER BY RANDOM()
  LIMIT 1;
  `, (err, data) => {
    if (err) {
      console.log(err);
      res.json({});
    } else {
      res.json(data.rows[0]);
    }
  });
}

/***************
 * Search page *
 ***************/

// Route 5: GET /search
const search = async function (req, res) {
  const keyword = req.query.keyword;
  const category = req.query.category ? req.query.category
    .split(',').map(item => `'${item}'`)
    .join(', ') : "'ALL'";

  if (!keyword || keyword.trim() === "") {
    return res.json([]);
  }
  connection.query(`
WITH k AS (
   SELECT '%' || LOWER('${keyword}') || '%' AS kw
)
SELECT
   p.person_id,
   p.name,
   COALESCE(
           p.image_url,
           'https://static.wikia.nocookie.net/pbskidsgo/images/5/57/Curious-George.jpg/revision/latest/scale-to-width-down/250?cb=20120712224008'
   ) AS image_url,
   EXTRACT(YEAR FROM p.birthdate)::int                     AS birth_year,
   COALESCE(ns.nepo_score, 0)                              AS nepo_score,
   COALESCE(pp.person_point, 0)                            AS person_point,
  (
       SELECT MIN(t.start_year)
       FROM core.principal pr
       LEFT JOIN core.title t ON t.tconst = pr.tconst
       WHERE pr.nconst = p.nconst
         AND LOWER(pr.category) NOT IN ('self', 'archive_footage', 'archive_sound')
   ) AS career_start_year,
   (
       SELECT t.primary_title
       FROM core.principal pr
                JOIN core.title t  ON t.tconst = pr.tconst
                JOIN core.rating r ON r.tconst = pr.tconst
       WHERE pr.nconst = p.nconst
       ORDER BY r.num_votes DESC
       LIMIT 1
   )                                                       AS known_for_title,
   (
       SELECT ARRAY_AGG(DISTINCT INITCAP(pr.category) ORDER BY INITCAP(pr.category))
       FROM core.principal pr
       WHERE pr.nconst = p.nconst
         AND LOWER(pr.category) NOT IN ('self', 'archive_footage','archive_sound')
   )                                                       AS professions
FROM core.person p
        LEFT JOIN core.neposcore   ns ON ns.person_id = p.person_id
        LEFT JOIN core.personpoint pp ON pp.person_id = p.person_id
        CROSS JOIN k
WHERE LOWER(p.name) LIKE k.kw
 AND (
   ARRAY[${category}] = ARRAY['ALL']
       OR NOT EXISTS (
       SELECT UNNEST(ARRAY[${category}]::text[]) AS cat
       EXCEPT
       SELECT LOWER(pr.category)
       FROM core.principal pr
       WHERE pr.nconst = p.nconst
   )
   )
ORDER BY nepo_score DESC NULLS LAST, p.name
LIMIT 100;
  `, (err, data) => {
    if (err) {
      console.log(err);
      res.json({});
    } else {
      // if (data.rows && data.rows.length > 0) {
      //   res.json(data.rows);
      // } else {
      //   res.json({});
      // }
      res.json(data.rows);
    }
  });
}

/***********************
 * Personal page *
 ***********************/

// Route 6: GET /person/:person_id
const getPersonProfile = async function (req, res) {
  connection.query(`
WITH base_person AS (
    SELECT
        p.person_id,
        p.nconst,
        p.name,
        p.birthdate,
        COALESCE(
                p.image_url,
                'https://static.wikia.nocookie.net/pbskidsgo/images/5/57/Curious-George.jpg/revision/latest/scale-to-width-down/250?cb=20120712224008'
        ) AS image_url
    FROM core.person p
    WHERE p.person_id = '${req.params.person_id}'
),

     profession_counts AS (
         SELECT
             pr.nconst,
             pr.category,
             COUNT(*) AS category_count
         FROM core.principal pr
                  JOIN base_person bp USING (nconst)
         WHERE pr.category NOT IN ('self', 'archive_footage', 'archive_sound')
         GROUP BY pr.nconst, pr.category
     ),

     profession_agg AS (
         SELECT
             nconst,
             STRING_AGG(category, ', ' ORDER BY category_count DESC, category) AS professions
         FROM profession_counts
         GROUP BY nconst
     ),

     kinship_summary AS (
         SELECT
             COUNT(DISTINCT CASE
                                WHEN k.kinship = 'PARENT' THEN k.related_person_id
                 END) AS parent_count,
             COUNT(DISTINCT CASE
                                WHEN k.kinship = 'GRANDPARENT' THEN k.related_person_id
                 END) AS grandparent_count,
             COUNT(DISTINCT CASE
                                WHEN k.kinship NOT IN (
                                                       'PARENT', 'GRANDPARENT',
                                                       'SPOUSE', 'UNKNOWN', 'RELATIVE'
                                    )
                                    AND k.kinship NOT LIKE '%INLAW%'
                                    AND k.kinship NOT LIKE 'STEP%'
                                    THEN k.related_person_id
                 END) AS relative_count
         FROM core.kinship k
                  JOIN base_person bp USING (person_id)
     ),

     all_titles AS (
         SELECT DISTINCT
             pr.tconst
         FROM core.principal pr
                  JOIN base_person bp USING (nconst)
     ),

     credited_titles AS (
         SELECT
             pr.tconst,
             MAX(CASE WHEN pr.category = 'actor' THEN 1 ELSE 0 END) AS is_actor,
             MAX(CASE WHEN pr.category = 'director' THEN 1 ELSE 0 END) AS is_director,
             STRING_AGG(DISTINCT pr.category, ', ' ORDER BY pr.category) AS categories
         FROM core.principal pr
                  JOIN base_person bp USING (nconst)
         WHERE pr.category NOT IN ('self', 'archive_footage', 'archive_sound')
         GROUP BY pr.tconst
     ),

     career_summary AS (
         SELECT
             (SELECT COUNT(*) FROM all_titles) AS total_titles,
             COUNT(*) FILTER (WHERE ct.is_actor = 1) AS acting_titles,
             COUNT(*) FILTER (WHERE ct.is_director = 1) AS directing_titles,
             MIN(t.start_year) AS career_start_year,
             MAX(t.start_year) AS latest_title_year,
             AVG(rt.average_rating)::NUMERIC(10, 2) AS avg_rating,
             (
                 SELECT SUM(COALESCE(rt2.num_votes, 0))
                 FROM all_titles at2
                          LEFT JOIN core.rating rt2
                                    ON rt2.tconst = at2.tconst
             ) AS total_votes,
             (
                 SELECT JSONB_AGG(cat_counts ORDER BY title_count DESC, category)
                 FROM (
                          SELECT
                              pr2.category,
                              COUNT(DISTINCT pr2.tconst) AS title_count
                          FROM core.principal pr2
                                   JOIN base_person bp2 USING (nconst)
                          WHERE pr2.category NOT IN ('self', 'archive_footage', 'archive_sound')
                          GROUP BY pr2.category
                          ORDER BY title_count DESC, pr2.category
                          LIMIT 3
                      ) cat_counts
             ) AS top_categories
         FROM credited_titles ct
                  LEFT JOIN core.title t
                            ON t.tconst = ct.tconst
                  LEFT JOIN core.rating rt
                            ON rt.tconst = ct.tconst
     ),

     top_titles AS (
         SELECT
             t.tconst,
             t.primary_title,
             t.title_type,
             t.start_year,
             STRING_AGG(DISTINCT pr.category, ', ' ORDER BY pr.category) AS category,
             rt.average_rating,
             rt.num_votes
         FROM core.principal pr
                  JOIN base_person bp
                       ON bp.nconst = pr.nconst
                  JOIN core.title t
                       ON t.tconst = pr.tconst
                  LEFT JOIN core.rating rt
                            ON rt.tconst = t.tconst
         GROUP BY
             t.tconst,
             t.primary_title,
             t.title_type,
             t.start_year,
             rt.average_rating,
             rt.num_votes
         ORDER BY
             rt.num_votes DESC NULLS LAST,
             t.start_year DESC NULLS LAST,
             t.tconst
         LIMIT 20
     )

SELECT
    bp.person_id,
    bp.name AS primary_name,
    EXTRACT(YEAR FROM bp.birthdate)::INT AS birth_year,
    pa.professions,
    ns.nepo_score,
    ks.parent_count,
    ks.grandparent_count,
    ks.relative_count,
    bp.image_url,
    cs.total_titles,
    cs.acting_titles,
    cs.directing_titles,
    cs.career_start_year,
    cs.latest_title_year,
    cs.avg_rating,
    cs.total_votes,
    cs.top_categories,
    COALESCE(
                    JSONB_AGG(
                    JSONB_BUILD_OBJECT(
                            'tconst',         tt.tconst,
                            'primary_title',  tt.primary_title,
                            'title_type',     tt.title_type,
                            'start_year',     tt.start_year,
                            'category',       tt.category,
                            'average_rating', tt.average_rating,
                            'num_votes',      tt.num_votes
                    )
                    ORDER BY
                        tt.num_votes DESC NULLS LAST,
                        tt.start_year DESC NULLS LAST,
                        tt.tconst
                             ) FILTER (WHERE tt.tconst IS NOT NULL),
                    '[]'::jsonb
    ) AS top_titles
FROM base_person bp
         CROSS JOIN kinship_summary ks
         CROSS JOIN career_summary cs
         LEFT JOIN top_titles tt
                   ON TRUE
         LEFT JOIN profession_agg pa
                   ON pa.nconst = bp.nconst
         LEFT JOIN core.neposcore ns
                   ON ns.person_id = bp.person_id
GROUP BY
    bp.person_id,
    bp.name,
    bp.birthdate,
    bp.image_url,
    pa.professions,
    ns.nepo_score,
    ks.parent_count,
    ks.grandparent_count,
    ks.relative_count,
    cs.total_titles,
    cs.acting_titles,
    cs.directing_titles,
    cs.career_start_year,
    cs.latest_title_year,
    cs.avg_rating,
    cs.total_votes,
    cs.top_categories;
  `, (err, data) => {
    if (err) {
      console.log(err);
      res.json({});
    } else {
      res.json(data.rows);
    }
  });
}

// PLACEHOLDER   Route 7: GET /person/:person_id/family 
const getPersonFamliy = async function (req, res) {
  connection.query(`
    SELECT
      k.person_id,
      p1.name AS person_name,
      ns1.nepo_score AS person_nepo_score,
      k.related_person_id,
      p2.name AS related_person_name,
      ns2.nepo_score AS related_person_nepo_score,
      COALESCE(
        p2.image_url,
        'https://static.wikia.nocookie.net/pbskidsgo/images/5/57/Curious-George.jpg/revision/latest/scale-to-width-down/250?cb=20120712224008'
      ) AS related_person_image_url,
      k.kinship
    FROM core.kinship k
      JOIN core.person p1 ON k.person_id = p1.person_id
      JOIN core.person p2 ON k.related_person_id = p2.person_id
      JOIN core.neposcore ns1 ON k.person_id = ns1.person_id
      JOIN core.neposcore ns2 ON k.related_person_id = ns2.person_id
    WHERE k.person_id = '${req.params.person_id}'
    ORDER BY k.degree ASC, k.gen_delta DESC;
  `, (err, data) => {
    if (err) {
      console.log(err);
      res.json({});
    } else {
      res.json(data.rows);
    }
  });
}

// PLACEHOLDER     Route 8: GET /person/:person_id/collaborators
const getPersonCollaborators = async function (req, res) {
  connection.query(`
    SELECT
      pe1.person_id AS person_id,
      pe1.name AS person_name,
      pe2.person_id AS colleague_id,
      pe2.name AS colleague_name,
      COALESCE(
        pe2.image_url,
        'https://static.wikia.nocookie.net/pbskidsgo/images/5/57/Curious-George.jpg/revision/latest/scale-to-width-down/250?cb=20120712224008'
      ) AS colleague_image_url,
      COUNT(DISTINCT p1.tconst) AS total_collaborations
    FROM core.principal p1
      JOIN core.principal p2 ON p1.tconst = p2.tconst
      JOIN core.person pe1 ON pe1.nconst = p1.nconst
      JOIN core.person pe2 ON pe2.nconst = p2.nconst
    WHERE pe1.person_id = '${req.params.person_id}'
      AND pe2.person_id != '${req.params.person_id}'
      AND p2.category IN ('actor', 'actress')
    GROUP BY pe1.person_id, pe1.name, pe2.person_id, pe2.name
    HAVING COUNT(p1.tconst) >= 2
    ORDER BY total_collaborations DESC, colleague_name ASC
    LIMIT 10;
  `, (err, data) => {
    if (err) {
      console.log(err);
      res.json({});
    } else {
      res.json(data.rows);
    }
  });
}

/*******************
 * Comparison page *
 *******************/

// Route 10: GET /compare
const compareAvsB = async function (req, res) {
  const nameA = req.query.person_name_a ?? '';
  const nameB = req.query.person_name_b ?? '';

  if (!nameA || !nameB) {
    return res.json({});
  }

  connection.query(`
        WITH params(person_name) AS (
      VALUES
      ('${nameA}'),
      ('${nameB}')
    ),




    profile AS (
    SELECT
      p.person_id,
      p.name,
      p.gender,
      p.birthdate,
      p.nconst,
      p.image_url
    FROM core.person p
    JOIN params x
      ON LOWER(p.name) = LOWER(x.person_name)
    ),




    credits AS (
    SELECT
      p.person_id,
      pr.tconst
    FROM profile p
    JOIN core.principal pr
      ON pr.nconst = p.nconst
    ),




    career_start AS (
    SELECT
      c.person_id,
      MIN(t.start_year) AS career_start_year
    FROM credits c
    JOIN core.title t
      ON t.tconst = c.tconst
    WHERE t.start_year IS NOT NULL
    GROUP BY c.person_id
    ),




    imdb AS (
    SELECT
      c.person_id,
      ROUND(AVG(r.average_rating),2)      AS avg_imdb_rating,
      SUM(r.num_votes)                    AS total_imdb_votes,
      COUNT(DISTINCT CASE WHEN r.average_rating >= 7 THEN c.tconst END) AS high_rated_films
    FROM credits c
    JOIN core.rating r
      ON r.tconst = c.tconst
    GROUP BY c.person_id
    ),




    category_breakdown AS (
    SELECT
      p.person_id,
      jsonb_agg(DISTINCT pr.category ORDER BY pr.category) AS category_breakdown
    FROM profile p
    JOIN core.principal pr
      ON pr.nconst = p.nconst
    WHERE pr.category <> ''
      AND pr.category NOT IN ('archive_footage', 'archive_sound', 'self')
    GROUP BY p.person_id
    ),




    famous_films AS (
    SELECT
      person_id,
      jsonb_agg(primary_title ORDER BY num_votes DESC) AS famous_films
    FROM (
      SELECT
        p.person_id,
        t.primary_title,
        r.num_votes,
        ROW_NUMBER() OVER (
          PARTITION BY p.person_id
          ORDER BY r.num_votes DESC
        ) AS rn
      FROM profile p
      JOIN core.principal pr
        ON pr.nconst = p.nconst
      JOIN core.title t
        ON t.tconst = pr.tconst
      LEFT JOIN core.rating r
        ON r.tconst = t.tconst
        WHERE r.num_votes IS NOT NULL
    ) x
    WHERE rn <= 3
    GROUP BY person_id
    ),




    awards AS (
    SELECT
      person_id,
      SUM(CASE WHEN LOWER(type) = 'award' THEN 1 ELSE 0 END)      AS personal_awards_count,
      SUM(CASE WHEN LOWER(type) = 'nomination' THEN 1 ELSE 0 END) AS personal_nominations_count
    FROM core.personaward
    WHERE person_id IN (SELECT person_id FROM profile)
    GROUP BY person_id
    ),




    relative_counts AS (
    SELECT
      k.person_id,
      COUNT(DISTINCT CASE
          WHEN k.kinship = 'PARENT'
          THEN k.related_person_id
      END) AS parent_count,




      COUNT(DISTINCT CASE
          WHEN k.kinship = 'GRANDPARENT'
          THEN k.related_person_id
      END) AS grandparent_count,




      COUNT(DISTINCT CASE
          WHEN k.kinship = 'RELATIVE'
          THEN k.related_person_id
      END) AS relative_count




    FROM core.kinship k
    JOIN profile p ON p.person_id = k.person_id
    WHERE k.kinship IN ('PARENT','GRANDPARENT','RELATIVE')
      AND EXISTS (
        SELECT 1
        FROM core.person relp
        JOIN core.principal pr2 ON pr2.nconst = relp.nconst
        WHERE relp.person_id = k.related_person_id
          AND relp.nconst IS NOT NULL
      )
    GROUP BY k.person_id
    ),




    nepo AS (
    SELECT
      n.person_id,
      n.nepo_score
    FROM core.neposcore n
    JOIN profile p ON p.person_id = n.person_id
    )




    SELECT
    p.person_id,
    p.name,
    p.gender,
    TO_CHAR(p.birthdate, 'YYYY-MM-DD') AS birthdate,
    p.image_url,
    cs.career_start_year,
    ff.famous_films,
    cb.category_breakdown,
    i.avg_imdb_rating,
    i.total_imdb_votes,
    i.high_rated_films,
    COALESCE(a.personal_awards_count, 0)      AS personal_awards_count,
    COALESCE(a.personal_nominations_count, 0) AS personal_nominations_count,
    COALESCE(n.nepo_score, 0)                AS nepo_score,
    COALESCE(rc.parent_count, 0)              AS parent_count,
    COALESCE(rc.grandparent_count, 0)         AS grandparent_count,
    COALESCE(rc.relative_count, 0)            AS relative_count




    FROM profile p
    LEFT JOIN career_start       cs ON cs.person_id = p.person_id
    LEFT JOIN famous_films       ff ON ff.person_id = p.person_id
    LEFT JOIN category_breakdown cb ON cb.person_id = p.person_id
    LEFT JOIN imdb               i  ON i.person_id  = p.person_id
    LEFT JOIN awards             a  ON a.person_id  = p.person_id
    LEFT JOIN nepo               n  ON n.person_id  = p.person_id
    LEFT JOIN relative_counts    rc ON rc.person_id = p.person_id
    ORDER BY CASE WHEN LOWER(p.name) = LOWER('${nameA}') THEN 0 ELSE 1 END;
  `, (err, data) => {
    if (err) {
      console.log(err);
      res.json({});
    } else {
      const rowA = data.rows.find(r => r.name.toLowerCase() === nameA.toLowerCase()) ?? null;
      const rowB = data.rows.find(r => r.name.toLowerCase() === nameB.toLowerCase()) ?? null;
      res.json({ person_name_a: rowA, person_name_b: rowB });
    }
  });
}

/*******************
 * Analysis page *
 *******************/

// Route 11: GET /analysis/nepo_participation_industry

const getNepoParticipationIndustry = async function (req, res) {
  const start_year = req.query.start_year ?? 1900;
  const end_year = req.query.end_year ?? 2026;

  if (start_year > end_year) {
    return res.json({})
  }

  connection.query(`
    WITH nepoflag AS (
      SELECT DISTINCT k.person_id
      FROM core.kinship k
      LEFT JOIN core.person p
          ON p.person_id = k.related_person_id
      WHERE p.nconst IS NOT NULL
    ),
    YearlyStats AS (
      SELECT
        t.start_year AS release_year,
        COUNT(DISTINCT t.tconst) AS total_movie_count,
        COUNT(DISTINCT CASE
            WHEN n.person_id IS NOT NULL THEN t.tconst
        END) AS movies_with_nepo_participation
      FROM core.title t
          LEFT JOIN core.principal tp ON t.tconst = tp.tconst
          LEFT JOIN core.person p ON tp.nconst = p.nconst
          LEFT JOIN nepoflag n ON p.person_id = n.person_id
    WHERE t.title_type = 'movie' AND t.start_year IS NOT NULL
    GROUP BY t.start_year
    )
    SELECT
    release_year,
    movies_with_nepo_participation,
    total_movie_count
    FROM YearlyStats
    WHERE release_year BETWEEN ${start_year} AND ${end_year}
    ORDER BY release_year ASC;
  `, (err, data) => {
    if (err) {
      console.log(err);
      res.json({});
    } else {
      res.json(data.rows);
    }
  });
}

// Route 12: GET /analysis/top_nepo_collaborations
const getTopNepoCollaborations = async function (req, res) {
  connection.query(`
SELECT
 p1.name AS person_name,
 p2.name AS colleague_name,
 c.total_collaborations
FROM core.collaboration c
  JOIN core.person p1 ON c.person_id = p1.nconst
  JOIN core.person p2 ON c.colleague_id = p2.nconst
WHERE EXISTS (
  SELECT 1
  FROM core.kinship k
      LEFT JOIN core.person p ON p.person_id = k.related_person_id
  WHERE p.nconst IS NOT NULL AND
        k.person_id = p1.person_id AND (
          k.kinship = 'PARENT' OR k.kinship = 'GRANDPARENT' OR
          k.kinship = 'AUNT_UNCLE' OR k.kinship = 'GREAT_AUNT_UNCLE' OR
          k.kinship = 'ANCESTOR' OR k.kinship = 'COUSIN_1ST_1R_UP' OR
          k.kinship = 'COUSIN_1ST_2R_UP' or k.kinship = 'COUSIN_2ND_1R_UP'
        )
) AND EXISTS (
  SELECT 1
  FROM core.kinship k
      LEFT JOIN core.person p ON p.person_id = k.related_person_id
  WHERE p.nconst IS NOT NULL AND
        k.person_id = p2.person_id AND (
          k.kinship = 'PARENT' OR k.kinship = 'GRANDPARENT' OR
          k.kinship = 'AUNT_UNCLE' OR k.kinship = 'GREAT_AUNT_UNCLE' OR
          k.kinship = 'ANCESTOR' OR k.kinship = 'COUSIN_1ST_1R_UP' OR
          k.kinship = 'COUSIN_1ST_2R_UP' or k.kinship = 'COUSIN_2ND_1R_UP'
        )
)
ORDER BY total_collaborations DESC,person_name ASC
LIMIT 25;
  `, (err, data) => {
    if (err) {
      console.log(err);
      res.json({});
    } else {
      res.json(data.rows);
    }
  });
}

// Route 13: GET /analysis/nepo_industry_metrics
const getNepoIndustryMetrics = async function (req, res) {
  connection.query(`
    WITH nepo_flag AS (
      SELECT
          p.person_id,
          CASE
              WHEN ns.nepo_score > 0 THEN 'Nepo Baby'
              ELSE 'Non-Nepo'
              END AS nepo_status
      FROM core.person p
                LEFT JOIN core.neposcore ns
                          ON ns.person_id = p.person_id
    ),

        role_data AS (
            SELECT
                t.start_year AS year,
                pr.category AS profession,
                pr.ordering,
                pr.tconst,
                r.average_rating,
                r.num_votes,
                nf.nepo_status
            FROM core.principal pr
                    JOIN core.title t
                          ON t.tconst = pr.tconst
                    LEFT JOIN core.rating r
                              ON r.tconst = pr.tconst
                    JOIN core.person p
                          ON p.nconst = pr.nconst
                    JOIN nepo_flag nf
                          ON nf.person_id = p.person_id
            WHERE t.start_year IS NOT NULL
        )

    SELECT
      year,
      profession,
      nepo_status,

      COUNT(*) AS role_count,

      COUNT(DISTINCT tconst) AS movie_count,

      AVG(ordering)::numeric(10,2) AS avg_credit_order,

      AVG(average_rating)::numeric(10,2) AS avg_rating,

      AVG(num_votes)::numeric(12,2) AS avg_votes

    FROM role_data

    GROUP BY
      year,
      profession,
      nepo_status

    ORDER BY
      year,
      profession,
      nepo_status;
  `, (err, data) => {
    if (err) {
      console.log(err);
      res.json({});
    } else {
      res.json(data.rows);
    }
  });
}

/*******************
 * Nepo Movie page *
 *******************/

// Route 14: GET /movies/relative_collaboration_movies
const getRelativeCollaborationMovies = async function (req, res) {
  const page = req.query.page;
  const pageSize = req.query.page_size ? req.query.page_size : 10
  const offsetStr = page && page > 0
    ? `LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`
    : '';

  connection.query(`
SELECT
    tconst,
    primary_title,
    start_year,
    COUNT(DISTINCT (person_id_1, person_id_2)) AS relative_pair_count,
    JSONB_AGG(
        DISTINCT JSONB_BUILD_OBJECT(
            'person_name_1', person_name_1,
            'person_name_2', person_name_2,
            'kinship', kinship
        )
    ) AS relative_pairs,
    COUNT(DISTINCT genre) AS genre_count,
    COUNT(DISTINCT movie_award_id) AS movie_award_count,
    AVG(average_rating) AS avg_rating,
    SUM(num_votes) AS total_votes,
    (
        SELECT x.kinship
        FROM (
            SELECT kinship, COUNT(*) AS cnt
            FROM ( SELECT DISTINCT tconst,person_id_1,person_id_2,kinship FROM core.mv_one_movie_multi_rows) b
            WHERE b.tconst = a.tconst
            GROUP BY kinship
            ORDER BY cnt DESC, kinship
            LIMIT 1
        ) x
    ) AS most_frequent_kinship
FROM core.mv_one_movie_multi_rows a
GROUP BY
    tconst,
    primary_title,
    start_year
ORDER BY
    relative_pair_count DESC,
    primary_title
      ${offsetStr};
    `, (err, data) => {
    if (err) {
      console.log(err);
      res.json({});
    } else {
      res.json(data.rows);
    }
  })
}


module.exports = {
  getTopNepoBabies,
  getTrendingThisYear,
  getFamilyDynasties,
  getSurprisePerson,
  search,
  getPersonProfile,
  getPersonFamliy,
  getPersonCollaborators,
  compareAvsB,
  getNepoParticipationIndustry,
  getTopNepoCollaborations,
  getNepoIndustryMetrics,
  getRelativeCollaborationMovies,
}
