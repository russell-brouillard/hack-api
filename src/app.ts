import express from "express";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";
import routes from "./routes/allRoutes";
import cors from "cors";
import path from "path";

dotenv.config();

const app = express();

// // Custom middleware to add Access-Control-Allow-Origin header
// app.use((req, res, next) => {
//   res.setHeader("Access-Control-Allow-Origin", "https://www.pomerene.net");
//   next();
// });

// Apply CORS middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));


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

// Mount routes
app.use("/api/v1/", routes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}/api/v1/`);
  console.log(`API docs are running at http://localhost:${PORT}/api-docs`);
});
