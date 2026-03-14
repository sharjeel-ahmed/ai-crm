const router = require('express').Router();
const { apiKeyAuth } = require('../middleware/apiKeyAuth');
const { rateLimit } = require('../middleware/rateLimit');

const contacts = require('../controllers/contactsController');
const companies = require('../controllers/companiesController');
const deals = require('../controllers/dealsController');
const activities = require('../controllers/activitiesController');
const stages = require('../controllers/stagesController');
const partners = require('../controllers/partnersController');
const reports = require('../controllers/reportsController');

// All v1 routes require API key + rate limiting
router.use(apiKeyAuth);
router.use(rateLimit);

// Contacts
router.get('/contacts', contacts.getAll);
router.get('/contacts/:id', contacts.getById);

// Companies
router.get('/companies', companies.getAll);
router.get('/companies/:id', companies.getById);

// Deals
router.get('/deals', deals.getAll);
router.get('/deals/pipeline', deals.getPipeline);
router.get('/deals/owners', deals.getOwners);
router.get('/deals/:id', deals.getById);

// Activities
router.get('/activities', activities.getAll);
router.get('/activities/:id', activities.getById);

// Stages
router.get('/stages', stages.getAll);

// Partners
router.get('/partners', partners.getAll);
router.get('/partners/:id', partners.getById);

// Reports
router.get('/reports/dashboard', reports.dashboard);
router.get('/reports/funnel-dashboard', reports.funnelDashboard);
router.get('/reports/summary', reports.getSummary);
router.get('/reports/pipeline-value', reports.pipelineValue);
router.get('/reports/rep-performance', reports.repPerformance);
router.get('/reports/deal-aging', reports.dealAging);
router.get('/reports/attention', reports.attention);

module.exports = router;
