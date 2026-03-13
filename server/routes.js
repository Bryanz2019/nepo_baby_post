const { Pool, types } = require('pg');
const config = require('./config.json')

// Override the default parsing for BIGINT (PostgreSQL type ID 20)
types.setTypeParser(20, val => parseInt(val, 10));

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
  SELECT
    p.person_id,
    p.name,
    COALESCE(ns.nepo_score,0) AS nepo_score,

    COUNT(*) FILTER (WHERE k.kinship = 'PARENT')      AS parent_count,
    COUNT(*) FILTER (WHERE k.kinship = 'GRANDPARENT') AS grandparent_count,
    COUNT(*) FILTER (WHERE k.kinship = 'RELATIVE')    AS relative_count,

    COUNT(DISTINCT pr.tconst) AS total_titles,
    AVG(r.average_rating)     AS avg_rating

  FROM core.person p
          LEFT JOIN core.neposcore ns
                    ON ns.person_id = p.person_id
          LEFT JOIN core.kinship k
                    ON k.person_id = p.person_id
          LEFT JOIN core.principal pr
                    ON pr.nconst = p.nconst
          LEFT JOIN core.rating r
                    ON r.tconst = pr.tconst

  GROUP BY
    p.person_id,
    p.name,
    ns.nepo_score

  ORDER BY
    nepo_score DESC NULLS LAST,
    total_titles DESC

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
                JOIN core.principal pr
                    ON pr.nconst = p.nconst
                JOIN core.title t
                    ON t.tconst = pr.tconst
                JOIN core.rating r
                    ON r.tconst = t.tconst
                LEFT JOIN core.neposcore ns
                          ON ns.person_id = p.person_id


      WHERE t.start_year = EXTRACT(YEAR FROM CURRENT_DATE)::int
        AND r.average_rating IS NOT NULL
        AND COALESCE(ns.nepo_score,0) > 0
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
      SUM(num_votes) AS total_votes_this_year,


      STRING_AGG(primary_title, ', ' ORDER BY average_rating DESC)
      FILTER (WHERE rn <= 3) AS top_3_titles


    FROM ranked
    GROUP BY person_id, name, nepo_score
    ORDER BY nepo_score DESC,
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
    WITH family_groups AS (
      SELECT DISTINCT
          LEAST(k.person_id, k.related_person_id)    AS person_a,
          GREATEST(k.person_id, k.related_person_id) AS person_b
      FROM core.kinship k
      WHERE k.kinship IN ('PARENT', 'GRANDPARENT', 'ANCESTOR', 'SAMEGEN', 'RELATIVE')
    ),
    family_components AS (
      SELECT
          person_a AS person_id,
          person_a AS family_id
      FROM family_groups


      UNION


      SELECT
          person_b AS person_id,
          person_a AS family_id
      FROM family_groups
    ),

    family_assigned AS (
      SELECT
          person_id,
          MIN(family_id) AS family_id
      FROM family_components
      GROUP BY person_id
    ),

    family_named AS (
      SELECT
          fa.person_id,
          fa.family_id,
          p_root.name AS family_name,
          p.name      AS person_name,
          ns.nepo_score
      FROM family_assigned fa
      JOIN core.person p      ON p.person_id      = fa.person_id
      JOIN core.person p_root ON p_root.person_id = fa.family_id
      LEFT JOIN core.neposcore ns ON ns.person_id = fa.person_id
      WHERE ns.nepo_score IS NOT NULL
    )
    SELECT
      family_id,
      family_name                             AS family_root_person,
      COUNT(DISTINCT person_id)               AS family_members,
      AVG(nepo_score)::NUMERIC(10,2)          AS avg_family_nepo_score,
      MAX(nepo_score)      ::NUMERIC(10,2)                    AS top_family_nepo_score,
      STRING_AGG(person_name, ', '
          ORDER BY nepo_score DESC NULLS LAST) AS members
    FROM family_named
    GROUP BY family_id, family_name
    HAVING COUNT(DISTINCT person_id) >= 2
    ORDER BY avg_family_nepo_score DESC NULLS LAST,
            family_members DESC
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
      EXTRACT(YEAR FROM p.birthdate)::int AS birth_year,
      COALESCE(ns.nepo_score,0) AS nepo_score,
      'PERSON' AS result_type
    FROM core.person p
            LEFT JOIN core.neposcore ns
                      ON ns.person_id = p.person_id
            CROSS JOIN k
    WHERE LOWER(p.name) LIKE k.kw
    ORDER BY nepo_score DESC NULLS LAST,
            p.name
    LIMIT 20;
  `, (err, data) => {
    if (err) {
      console.log(err);
      res.json({});
    } else {
      if (data.rows && data.rows.length > 0) {
        res.json(data.rows);
      } else {
        res.json({});
      }
    }
  });
}

// Route 6: GET /search/advanced
const advancedSearch = async function(req, res) {
  let category_list_arr = "";
  let category_list_null = "";

  if (req.query.category_list) {
    category_list_arr = req.query.category_list
                          .split(',')
                          .map(item => `'${item}'`)
                          .join(', ');
    category_list_null = "'SOMETING HERE'";
  }
  else {
    category_list_arr = "''";
    category_list_null = 'NULL';
  }
  const year_start = req.query.year_start ?? 0;
  const year_end = req.query.year_end ?? 2026;
  const min_nepo_score = req.query.min_nepo_score ?? 0.0;

  connection.query(`
    SELECT DISTINCT
      p.person_id,
      p.name,
      ns.nepo_score,
      pr.category,
      MIN(t.start_year) OVER (PARTITION BY p.person_id) AS start_year


    FROM core.person p
            JOIN core.principal pr
                ON pr.nconst = p.nconst
            JOIN core.title t
                ON t.tconst = pr.tconst
            LEFT JOIN core.neposcore ns
                      ON ns.person_id = p.person_id


    WHERE (${category_list_null} IS NULL OR pr.category = ANY(ARRAY [${category_list_arr}]))
    AND (${year_start} IS NULL OR t.start_year >= ${year_start})
    AND (${year_end}  IS NULL OR t.start_year <= ${year_end})
    AND (${min_nepo_score} IS NULL OR COALESCE(ns.nepo_score,0) >= ${min_nepo_score})


    ORDER BY
      ns.nepo_score DESC NULLS LAST,
      start_year DESC NULLS LAST,
      p.name


    LIMIT 50;
  `, (err, data) => {
    if (err) {
      console.log(err);
      res.json({});
    } else {
      if (data.rows && data.rows.length > 0) {
        res.json(data.rows);
      } else {
        res.json({});
      }
    }
  });
}

/***********************
 * Personal page *
 ***********************/

// Route 7: GET /person/:person_id
const getPersonProfile = async function(req, res) {
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

// Route 8: GET /person/:person_id/family
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

// Route 9: GET /person/:person_id/collaborators
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

// Route 10: GET /compare
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


    p AS (
    SELECT
      per.person_id,
      per.name,
      per.gender,
      per.birthdate,
      per.nconst
    FROM core.person per
    JOIN params x
      ON LOWER(per.name) = LOWER(x.person_name)
    ),


    credits AS (
    SELECT
      p.person_id,
      pr.tconst
    FROM p
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


    pop_quality AS (
    SELECT
      c.person_id,
      ROUND(AVG(r.average_rating),2)      AS avg_imdb_rating,
      SUM(r.num_votes)::bigint            AS total_imdb_votes,
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
    FROM p
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
      FROM p
      JOIN core.principal pr
        ON pr.nconst = p.nconst
      JOIN core.title t
        ON t.tconst = pr.tconst
      LEFT JOIN core.rating r
        ON r.tconst = t.tconst
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
    WHERE person_id IN (SELECT person_id FROM p)
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
    JOIN p ON p.person_id = k.person_id
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
    JOIN p ON p.person_id = n.person_id
    )


    SELECT
    p.person_id,
    p.name,
    p.gender,
    p.birthdate,
    cs.career_start_year,
    ff.famous_films,
    cb.category_breakdown,
    pq.avg_imdb_rating,
    pq.total_imdb_votes,
    pq.high_rated_films,
    COALESCE(a.personal_awards_count, 0)      AS personal_awards_count,
    COALESCE(a.personal_nominations_count, 0) AS personal_nominations_count,
    COALESCE(ne.nepo_score, 0)                AS nepo_score,
    COALESCE(rc.parent_count, 0)              AS parent_count,
    COALESCE(rc.grandparent_count, 0)         AS grandparent_count,
    COALESCE(rc.relative_count, 0)            AS relative_count


    FROM p
    LEFT JOIN career_start       cs ON cs.person_id = p.person_id
    LEFT JOIN famous_films       ff ON ff.person_id = p.person_id
    LEFT JOIN category_breakdown cb ON cb.person_id = p.person_id
    LEFT JOIN pop_quality        pq ON pq.person_id = p.person_id
    LEFT JOIN awards             a  ON a.person_id  = p.person_id
    LEFT JOIN nepo               ne ON ne.person_id = p.person_id
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
      WHERE p.nconst IS NOT NULL AND k.person_id = p1.person_id
    ) AND EXISTS (
      SELECT 1
      FROM core.kinship k
          LEFT JOIN core.person p ON p.person_id = k.related_person_id
      WHERE p.nconst IS NOT NULL AND k.person_id = p2.person_id
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

// Route 12: GET /analysis/nepo_industry_metrics
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

  if (!page) {
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
        SUM(num_votes) AS total_votes
      FROM one_movie_multi_rows
      GROUP BY
        tconst,
        primary_title,
        start_year
      ORDER BY
        relative_pair_count DESC,
        primary_title;
    `, (err, data) => {
      if (err) {
        console.log(err);
        res.json({});
      } else {
        res.json(data.rows);
      }
    })
  } else{
    const offset = (page - 1) * pageSize;
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
        SUM(num_votes) AS total_votes
      FROM one_movie_multi_rows
      GROUP BY
        tconst,
        primary_title,
        start_year
      ORDER BY
        relative_pair_count DESC,
        primary_title
        LIMIT ${pageSize} OFFSET ${offset}
    `, (err, data) => {
      if (err) {
        console.log(err);
        res.json({});
      } else {
        res.json(data.rows);
      }
    })
  }
}


// Route ?: GET /tmp
const tmp = async function(req, res) {
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

module.exports = {
  getTopNepoBabies,
  getTrendingThisYear,
  getFamilyDynasties,
  getSurprisePerson,
  search,
  advancedSearch,
  getPersonProfile,
  getPersonFamliy,
  getPersonCollaborators,
  compareAvsB,
  compareChildParent,
  getNepoParticipationIndustry,
  getNepoIndustryMetrics,
  getRelativeCollaborationMovies,
  tmp
}
