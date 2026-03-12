-- Create and insert table 'kinship' in core
--in kinship each person only has their 'PARENT', 'GRANDPARENT', 'RELATIVE' on record
DROP TABLE IF EXISTS core.kinship CASCADE;

CREATE TABLE IF NOT EXISTS core.kinship (
person_id VARCHAR(20),
kinship VARCHAR(12),
related_person_id VARCHAR(20),
PRIMARY KEY (person_id, related_person_id)
);

INSERT INTO core.kinship (person_id, kinship, related_person_id)
WITH all_kinships AS (
-- Get direct kinships from your map
SELECT
r.person_id,
mk.kinship,
r.related_person_id
FROM core.relationship r
JOIN core.mapkinship mk ON r.relationship = mk.relationship
WHERE mk.kinship IN ('PARENT', 'GRANDPARENT', 'RELATIVE')

UNION ALL

-- Get inferred Grandparents (Parent of Parent)
SELECT
r.person_id,
GRANDPARENT' AS kinship,
r2.related_person_id
FROM core.relationship r
JOIN core.mapkinship mk ON r.relationship = mk.relationship
JOIN core.relationship r2 ON r.related_person_id = r2.person_id
JOIN core.mapkinship mk2 ON r2.relationship = mk2.relationship
WHERE mk.kinship = 'PARENT' AND mk2.kinship = 'PARENT'
),
ranked_kinships AS (
SELECT
person_id,
kinship,
related_person_id,
ROW_NUMBER() OVER (
PARTITION BY person_id, related_person_id
ORDER BY CASE kinship
WHEN 'PARENT' THEN 1
WHEN 'GRANDPARENT' THEN 2
WHEN 'RELATIVE' THEN 3
ELSE 4 END ASC
) as rank_priority
FROM all_kinships
)
SELECT person_id, kinship, related_person_id
FROM ranked_kinships rk
WHERE rank_priority = 1;
