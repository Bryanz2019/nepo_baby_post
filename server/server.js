const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const routes = require('./routes');

const app = express();

/*
const allowedOrigin = (config.client_host || '').trim();
const allowedUrl = allowedOrigin ? new URL(allowedOrigin) : null;

const corsOrigin = (origin, callback) => {
  if (!origin) {
    callback(null, true);
    return;
  }

  if (!allowedUrl) {
    callback(new Error('CORS is not configured: client_host is missing'));
    return;
  }

  try {
    const requestOrigin = new URL(origin);
    const isAllowed =
      requestOrigin.protocol === allowedUrl.protocol &&
      requestOrigin.hostname === allowedUrl.hostname;

    callback(null, isAllowed);
  } catch (err) {
    callback(null, false);
  }
};
*/

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
app.get('/compare', routes.compareAvsB);
app.get('/person/:person_id', routes.getPersonProfile);
app.get('/person/:person_id/family', routes.getPersonFamliy);
app.get('/person/:person_id/collaborators', routes.getPersonCollaborators);
app.get('/analysis/nepo_participation_industry', routes.getNepoParticipationIndustry);
app.get('/analysis/nepo_industry_metrics', routes.getNepoIndustryMetrics);
app.get('/analysis/top_nepo_collaborations', routes.getTopNepoCollaborations);
app.get('/movies/relative_collaboration_movies', routes.getRelativeCollaborationMovies);


module.exports.handler = serverless(app);