import express from "express";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";
import routes from "./routes";
import cors from "cors";

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Options for the swagger docs
const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Pomerene API Docs",
      version: "1.0.0",
      description: "pomerene SaaS web API documentation",
    },
  },
  apis: ["./routes/*.ts", "./src/controllers/*.ts"],
};

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJSDoc(options);

// Serve swagger docs
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// CORS Configuration
const corsOptions = {
  origin: "https://www.pomerene.net/",
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Mount routes
app.use("/api/v1/", routes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
  console.log(`API docs are running at http://localhost:${PORT}/api-docs`);
});
