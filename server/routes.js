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
const getTopNepoBabies = async function(req, res) {
  connection.query(`
    WITH kinship_agg AS (
      SELECT
          person_id,
          COUNT(DISTINCT CASE WHEN kinship = 'PARENT'      THEN related_person_id END) AS parent_count,
          COUNT(DISTINCT CASE WHEN kinship = 'GRANDPARENT' THEN related_person_id END) AS grandparent_count,
          COUNT(DISTINCT CASE WHEN kinship NOT IN (
                                                    'PARENT', 'GRANDPARENT',
                                                    'SPOUSE', 'UNKNOWN', 'RELATIVE'
              )
              AND kinship NOT LIKE '%INLAW%'
              AND kinship NOT LIKE 'STEP%'
                                  THEN related_person_id END)                                               AS relative_count
      FROM core.kinship
      GROUP BY person_id
    ),


        title_agg AS (
            SELECT
                pr.nconst,
                COUNT(DISTINCT pr.tconst)             AS total_titles,
                AVG(r.average_rating)::NUMERIC(10, 2) AS avg_rating
            FROM core.principal pr
                    LEFT JOIN core.rating r ON r.tconst = pr.tconst
            WHERE pr.category NOT IN ('self', 'archive_footage')
            GROUP BY pr.nconst
        ),


        category_agg AS (
            SELECT
                nconst,
                JSONB_AGG(
                        JSONB_BUILD_OBJECT('category', category, 'title_count', title_count)
                        ORDER BY title_count DESC
                ) AS top_categories
            FROM (
                    SELECT
                        nconst,
                        category,
                        COUNT(DISTINCT tconst) AS title_count,
                        ROW_NUMBER() OVER (PARTITION BY nconst ORDER BY COUNT(DISTINCT tconst) DESC) AS rn
                    FROM core.principal
                    WHERE category NOT IN ('self', 'archive_footage')
                    GROUP BY nconst, category
                ) ranked
            WHERE rn <= 3
            GROUP BY nconst
        )


    SELECT
      p.person_id,
      p.name,
      COALESCE(ns.nepo_score, 0) AS nepo_score,


      COALESCE(k.parent_count,      0) AS parent_count,
      COALESCE(k.grandparent_count, 0) AS grandparent_count,
      COALESCE(k.relative_count,    0) AS relative_count,


      COALESCE(t.total_titles, 0)      AS total_titles,
      t.avg_rating,
      c.top_categories


    FROM core.person p
            LEFT JOIN core.neposcore ns ON ns.person_id = p.person_id
            LEFT JOIN kinship_agg    k  ON k.person_id  = p.person_id
            LEFT JOIN title_agg      t  ON t.nconst     = p.nconst
            LEFT JOIN category_agg   c  ON c.nconst     = p.nconst


    ORDER BY
      nepo_score   DESC NULLS LAST,
      total_titles DESC,
      p.person_id

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

// Route 2: GET /homepage/trending_this_year
const getTrendingThisYear = async function(req, res) {
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
const getFamilyDynasties = async function(req, res) {
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
const getSurprisePerson = async function(req, res) {
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
const search = async function(req, res) {
  const keyword = req.query.keyword;
  const category = req.query.category ? req.query.category
                          .split(',').map(item => `'${item}'`)
                          .join(', ') : "'ALL'";

  if (!keyword || keyword.trim() === "") {
    return res.json({});
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
         AND LOWER(pr.category) != 'self'
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
const getPersonProfile = async function(req, res) {
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
            COUNT(DISTINCT CASE WHEN k.kinship = 'PARENT'
                                    THEN k.related_person_id END)                                         AS parent_count,
            COUNT(DISTINCT CASE WHEN k.kinship = 'GRANDPARENT'
                                    THEN k.related_person_id END)                                         AS grandparent_count,
            COUNT(DISTINCT CASE WHEN k.kinship NOT IN (
                                                       'PARENT', 'GRANDPARENT',
                                                       'SPOUSE', 'UNKNOWN', 'RELATIVE'
                )
                AND k.kinship NOT LIKE '%INLAW%'
                AND k.kinship NOT LIKE 'STEP%'
                                    THEN k.related_person_id END)                                         AS relative_count
        FROM core.kinship k
                 JOIN base_person bp USING (person_id)
    ),


    career_summary AS (
        SELECT
            COUNT(DISTINCT pr.tconst)                                               AS total_titles,
            COUNT(DISTINCT CASE WHEN pr.category = 'actor'    THEN pr.tconst END)  AS acting_titles,
            COUNT(DISTINCT CASE WHEN pr.category = 'director' THEN pr.tconst END)  AS directing_titles,
            MIN(t.start_year)                                                        AS career_start_year,
            MAX(t.start_year)                                                        AS latest_title_year,
            AVG(rt.average_rating)::NUMERIC(10, 2)                                  AS avg_rating,
            SUM(rt.num_votes)                                                        AS total_votes,
            (
                SELECT JSONB_AGG(cat_counts ORDER BY title_count DESC)
                FROM (
                         SELECT
                             pr2.category,
                             COUNT(DISTINCT pr2.tconst) AS title_count
                         FROM core.principal pr2
                                  JOIN base_person bp2 USING (nconst)
                         WHERE pr2.category NOT IN ('self', 'archive_footage')
                         GROUP BY pr2.category
                         ORDER BY title_count DESC
                         LIMIT 3
                     ) cat_counts
            ) AS top_categories
        FROM core.principal pr
                 JOIN base_person bp      USING (nconst)
                 LEFT JOIN core.title t   ON t.tconst  = pr.tconst
                 LEFT JOIN core.rating rt ON rt.tconst = pr.tconst
        WHERE pr.category != 'self'
    ),


    top_titles AS (
        SELECT distinct
            t.tconst,
            t.primary_title,
            t.title_type,
            t.start_year,
            pr.category,
            rt.average_rating,
            rt.num_votes
        FROM core.principal pr
                 JOIN base_person bp       USING (nconst)
                 JOIN core.title t         ON t.tconst  = pr.tconst
                 LEFT JOIN core.rating rt  ON rt.tconst = t.tconst
        WHERE pr.category NOT IN ('self', 'archive_footage', 'archive_sound')
        ORDER BY
            rt.average_rating DESC NULLS LAST,
            rt.num_votes      DESC NULLS LAST,
            t.start_year      DESC NULLS LAST
        LIMIT 20
    )


SELECT
   bp.person_id,
   bp.name                               AS primary_name,
   EXTRACT(YEAR FROM bp.birthdate)::INT  AS birth_year,
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
               tt.average_rating DESC NULLS LAST,
               tt.num_votes      DESC NULLS LAST,
               tt.start_year     DESC NULLS LAST
   ) AS top_titles


FROM base_person bp
        CROSS JOIN kinship_summary ks
        CROSS JOIN career_summary cs
        CROSS JOIN top_titles tt
        LEFT JOIN profession_agg  pa ON pa.nconst    = bp.nconst
        LEFT JOIN core.neposcore  ns ON ns.person_id = bp.person_id


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
const getPersonFamliy = async function(req, res) {
  connection.query(`
    SELECT *
    FROM core.person
    LIMIT 10
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
const getPersonCollaborators = async function(req, res) {
  connection.query(`
    SELECT *
    FROM core.person
    LIMIT 10
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

// QUERY NEEDS CHANGES Route 10: GET /compare
const compareAvsB = async function(req, res) {
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
    ORDER BY p.person_id;
  `, (err, data) => {
    if (err) {
      console.log(err);
      res.json({});
    } else {
      res.json({person_name_a: data.rows[0], 
        person_name_b: data.rows[1]});
    }
  });
}

/*******************
 * Analysis page *
 *******************/

// Route 11: GET /analysis/nepo_participation_industry

const getNepoParticipationIndustry = async function(req, res) {
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
const getTopNepoCollaborations = async function(req, res) {
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
const getNepoIndustryMetrics = async function(req, res) {
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
const getRelativeCollaborationMovies = async function(req, res) {
  const page = req.query.page;
  const pageSize = req.query.page_size ? req.query.page_size : 10
  const offsetStr = page && page > 0
  ? `LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`
  : '';

  connection.query(`
      WITH one_movie_multi_rows AS (
        SELECT
            rc.tconst,
            t.primary_title,
            t.start_year,
            rc.person_id_1,
            rc.person_name_1,
            rc.person_id_2,
            rc.person_name_2,
            rc.kinship,
            g.genre,
            r.average_rating,
            r.num_votes,
            ma.award_id AS movie_award_id
        FROM core.mv_relative_collaborator_pairs rc
        JOIN core.title t
          ON t.tconst = rc.tconst
        LEFT JOIN core.genres g
          ON g.tconst = rc.tconst
        LEFT JOIN core.rating r
          ON r.tconst = rc.tconst
        LEFT JOIN core.movieaward ma
          ON ma.tconst = rc.tconst
        WHERE t.title_type = 'movie'
      )


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
                FROM ( SELECT DISTINCT tconst,person_id_1,person_id_2,kinship FROM one_movie_multi_rows) b
                WHERE b.tconst = a.tconst
                GROUP BY kinship
                ORDER BY cnt DESC, kinship
                LIMIT 1
            ) x
        ) AS most_frequent_kinship
      FROM one_movie_multi_rows a
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
