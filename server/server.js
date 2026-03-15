const express = require('express');
const cors = require('cors');
const config = require('./config');
const routes = require('./routes');

const app = express();
app.use(cors({
  origin: '*',
}));

app.get('/', (req, res) => {
  res.send('Hello from the Node.js backend!');
});

app.get('/homepage/top_nepo_babies', routes.getTopNepoBabies);
app.get('/homepage/trending_this_year', routes.getTrendingThisYear);
app.get('/homepage/family_dynasties', routes.getFamilyDynasties);
app.get('/homepage/surprise_me', routes.getSurprisePerson);
app.get('/search', routes.search);
app.get('/search/advanced', routes.advancedSearch);
app.get('/compare', routes.compareAvsB);
app.get('/person/:person_id', routes.getPersonProfile);
app.get('/person/:person_id/family', routes.getPersonFamliy);
app.get('/person/:person_id/collaborators', routes.getPersonCollaborators);
app.get('/analysis/nepo_participation_industry', routes.getNepoParticipationIndustry);
app.get('/analysis/nepo_industry_metrics', routes.getNepoIndustryMetrics);
app.get('/analysis/top_nepo_collaborations', routes.getTopNepoCollaborations);
app.get('/movies/relative_collaboration_movies', routes.getRelativeCollaborationMovies);

app.listen(config.server_port, () => {
  console.log(`Server running at http://${config.server_host}:${config.server_port}/`)
});

module.exports = app;
