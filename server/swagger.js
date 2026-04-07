const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ORIS API',
      version: '2.0.0',
      description: 'API Documentation for ORIS Incident Response Platform',
    },
    servers: [
      {
        url: '/api',
        description: 'ORIS Backend Server',
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'token'
        }
      }
    },
    security: [{
      cookieAuth: []
    }]
  },
  apis: ['./routes/*.js', './routes/*.ts'], 
};

const swaggerSpec = swaggerJSDoc(options);

const setupSwagger = (app) => {
  app.use('/api-docs-ui', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'ORIS API Documentation'
  }));
  
  // Expose JSON format as well
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
};

module.exports = setupSwagger;
