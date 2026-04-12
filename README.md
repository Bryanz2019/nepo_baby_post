# Nepo Baby Post

A full-stack web application that examines nepotism trends by analyzing familial relations in the Film and TV series business.


---

## Project Overview

The **Nepo Baby Post** allows users to discover family connections, identify family members who appear in the same productions, and compare career paths across generations. By analyzing parental success, sibling connections, and extended family in Hollywood, the application generates a dynamic score to quantify the career advantages a celebrity may have inherited.

## Key Features & Pages

The application is divided into several specialized views, each powered by dedicated API endpoints:

### Home Dashboard
* **Top Nepo Babies:** View the highest-ranked individuals based on our scoring algorithm.
* **Surprise Me:** Discover random celebrity profiles and their hidden connections.
* **Trending & Dynasties:** Explore who is trending this year and deep-dives into famous Hollywood "Family Dynasties."
* **Endpoints:** `/homepage/top_nepo_babies`, `/homepage/family_dynasties`, `/homepage/trending_this_year`.

### Search & Discovery
* **Advanced Search:** Filter by year, family name, minimum nepo score, or specific career metrics.
* **Endpoints:** `/search`.

### Profile & Relationship Mapping
* **Personalized Insights:** Detailed breakdown of a celebrity's career and "nepo score."
* **Collaborators & Family:** View who they work with most and a full map of their familial ties.
* **Endpoints:** `/person/:person_id`, `/person/:person_id/collaborators`, `/person/:person_id/family`.

### Industry Analysis
* **Macro Metrics:** Analysis of "nepo participation" across different sectors of the film and TV series industry.
* **Collaborations:** Highlighting the most frequent pairings between established industry families.
* **Endpoints:** `/analysis/nepo_participation_industry`, `/analysis/top_nepo_collaborations`, `/analysis/nepo_industry_metrics`.

### Comparison & Media
* **Compare Tool:** Side-by-side comparison of two celebrities' backgrounds and scores.
* **Nepo Movies:** A specialized view of films featuring significant relative collaborations.
* **Endpoints:** `/compare`, `/movies/relative_collaboration_movies`.

---

## Repository Structure

The project is organized into four main directories:

### 1. `.github`
Contains **GitHub Actions** workflows for Continuous Integration/Continuous Deployment (CI/CD) and templates for ensuring consistency across the team.

### 2. `Database`
The data engineering hub of the project, managing the full ETL (Extract, Transform, Load) lifecycle:
* **`Data/raw/`**: Directory containing the original CSV datasets and data extraction files.
* **Data Ingestion (`src/loaders/import_postgres.py` scripts)**: Python scripts used to automate the loading process from CSV files into "raw" staging tables in PostgreSQL.
* **Schema & DDL (`sql/schema/core_ddl_load.sql`)**: 
    * **DDL**: Defines the core relational schema, including table structures and constraints.
    * **Transformation**: SQL logic to move and clean data from raw staging tables into the finalized "core" tables.

### 3. `server`
The **Node.js/Express** backend, responsible for:
* **API Routes:** Endpoints for fetching celebrity data and calculated scores.
* **Database Connection:** Configuration for the Pool/Client connection to PostgreSQL.

### 4. `frontend`
The **React** client-side application, including:
* **Components:** UI elements like search bars, profile cards, and score meters.
* **State Management:** Logic for handling user interactions and API responses.
* **Styling:** CSS/SCSS files defining the visual look and feel.

---

## Getting Started

To run the website locally, you need to start both the server and the frontend.

### 1. Start the Server
Navigate to the server directory and run:
```bash
npm run dev
```

### 2. Start the Frontend
Open a new terminal, navigate to the frontend directory, and run:
```bash
npm run dev
```

---

## Project Dependencies

The fullstack application is implemented using **React** on the frontend and **Nodejs** for the backend. All of the data used by the application is stored on a **PostgreSQL** database, named ‘nepo’, hosted by **AWS RDS**.  In order to retrieve this data, the application backend implemented **REST APIs** using the **Expressjs** framework to communicate with the PostgreSQL database. We then used **Jest** and **Supertest** to validate the endpoint results to ensure all API routes exhibit the expected behavior. For the UI/UX aspect of the application, we used **Tailwind CSS**, **DaisyUI**, and the **Recharts library** to customize the CSS theme and components, and create visually appealing charts correspondingly.