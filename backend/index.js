const express = require('express');
const { Client } = require('pg');
const cors = require('cors');
const promClient = require('prom-client');  // 🔁 Prometheus

const app = express();
const port = 5000;
require('dotenv').config();

const dbHost = process.env.DB_HOST;
const dbUser = process.env.DB_USER;
const dbPass = process.env.DB_PASSWORD;

console.log(dbHost);

const corsOptions = {
  origin: 'http://localhost',
  methods: 'GET,POST',
  allowedHeaders: 'Content-Type',
};

app.use(cors(corsOptions));
app.use(express.json());

// 🔁 Prometheus metrics setup
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics();

const httpRequestCounter = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});


// 🔁 Prometheus metrics DB insert count
const userInsertCounter = new promClient.Counter({
  name: 'user_inserts_total',
  help: 'Total number of users inserted into the database',
});


// PostgreSQL connection
const client = new Client({
  host: process.env.DB_HOST || 'postgres',
  port: 5432,
  user: process.env.DB_USER || 'shank',
  password: process.env.DB_PASSWORD || 'admin12345',
  database: process.env.DB_NAME || 'primarydb',
});

client.connect()
  .then(() => console.log('Connected to PostgreSQL'))
  .catch(err => console.error('Error connecting to PostgreSQL', err.stack));

// Create users table if not exists
const createTableQuery = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    age INT,
    mobile VARCHAR(20),
    place VARCHAR(100),
    amount DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

client.query(createTableQuery, (err, res) => {
  if (err) {
    console.error('Error creating table:', err.stack);
  } else {
    console.log('Table "users" is ready or already exists.');
  }
});

// 🔁 Middleware to count all HTTP requests
app.use((req, res, next) => {
  res.on('finish', () => {
    httpRequestCounter.inc({ 
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode 
    });
  });
  next();
});

// Search endpoint
app.get('/api/search', async (req, res) => {
  const { name, mobile } = req.query;
  let query = 'SELECT * FROM users WHERE 1=1';
  let params = [];

  if (name) {
    query += ' AND name ILIKE $' + (params.length + 1);
    params.push(`%${name}%`);
  }
  if (mobile) {
    query += ' AND mobile ILIKE $' + (params.length + 1);
    params.push(`%${mobile}%`);
  }

  try {
    const result = await client.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch search results' });
  }
});

// Create user endpoint
app.post('/api/data', async (req, res) => {
  const { name, age, mobile, place, amount } = req.body;

  try {
    const result = await client.query(
      'INSERT INTO users (name, age, mobile, place, amount) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, age, mobile, place, amount]
    );
    userInsertCounter.inc();  // 🔁 Prometheus: count the insert
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to insert user' });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.send('Welcome to the backend API!');
});

// 🔁 Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

app.listen(port, () => {
  console.log(`Backend API is listening on port ${port}`);
});









THEN Configure Prometheus
Prometheus should scrape from your app's /metrics endpoint. You can use a ServiceMonitor or static config like this:


- job_name: 'my-app'
  metrics_path: /metrics
  static_configs:
    - targets: ['my-app-service.default.svc.cluster.local:5000']




THEN  Create the ServiceMonitor


apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: my-app-monitor
  namespace: monitoring  # Same namespace where Prometheus is installed
  labels:
    release: prometheus  # This should match your Prometheus Helm release name
spec:
  selector:
    matchLabels:
      app: my-app  # This should match the label on your Service
  namespaceSelector:
    matchNames:
      - default  # or the namespace where your app is deployed
  endpoints:
    - port: http
      path: /metrics
      interval: 15s



THEN Apply It
Save it as my-app-servicemonitor.yaml, then apply it:

kubectl apply -f my-app-servicemonitor.yaml


Verify in Prometheus
Port forward Prometheus:

kubectl port-forward svc/prometheus-kube-prometheus-prometheus -n monitoring 9090
Visit: http://localhost:9090

Go to "Targets" (/targets) and look for my-app-monitor — it should be up and scraping /metrics
