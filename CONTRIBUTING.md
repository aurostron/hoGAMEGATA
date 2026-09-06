# Contributing to hoGAMEGATA

Thank you for your interest in contributing to hoGAMEGATA! We are an open-core, non-commercial digital preservation and discovery platform dedicated to cataloging and preserving the history of horror video games.

---

## 1. Our Open-Core Model

Before contributing, please review our open-core architectural boundary:

* **Open for Contribution**:
  * The Astro 5/7 frontend web application and pages
  * React island components and interactive widgets
  * Search DSL, filtering logic, and client-side indexing algorithms
  * CSS/Tailwind 4 styling, dark mode polishing, and responsive UI
  * Accessibility (a11y) improvements and cross-browser bug fixes
  * Documentation, setup guides, and architectural diagrams

* **Protected / Out of Scope for External Contributions**:
  * Proprietary Scare Meter intensity models and algorithmic scoring weights
  * Internal horror micro-genre taxonomy classification training files
  * Production Turso cloud database credentials and synchronization keys
  * User account schemas, authentication secrets, and private operational data

---

## 2. Development Setup

### Prerequisites
* **Node.js**: `v22.12.0` or higher
* **npm**: `v10+` (or compatible package manager)
* **Git**

### Quickstart

1. **Fork and Clone**:
   ```bash
   git clone https://github.com/<your-username>/gamegata-v1.git
   cd gamegata-v1
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy the example environment configuration:
   ```bash
   cp .env.example .env
   ```
   > **Note**: You do *not* need production database credentials to run the frontend! The development server defaults to local mock/development data when `TURSO_DATABASE_URL` is omitted.

4. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:4321](http://localhost:4321) in your browser.

---

## 3. Pull Request Guidelines

1. **Branch Naming**:
   * `feat/your-feature-name` for new user-facing capabilities or UI components
   * `fix/issue-description` for bug and regression fixes
   * `docs/update-topic` for documentation and architecture updates
   * `perf/optimization-target` for performance and bundle improvements

2. **Code Standards**:
   * Use TypeScript for all script logic and component props.
   * Ensure components are responsive across mobile, tablet, and desktop viewports.
   * Preserve existing docstrings and comments.
   * Avoid committing any local database binaries (`*.db`, `*.sqlite`) or secret keys.

3. **Pre-PR Verification**:
   Before submitting your Pull Request, ensure that the application builds cleanly:
   ```bash
   npm run build:quick
   ```

---

## 4. Community & Code of Conduct

We are committed to providing a welcoming, inclusive, and harassment-free environment for everyone, regardless of background, gender, sexual orientation, disability, physical appearance, race, or religion.

Please treat fellow contributors with kindness, empathy, and professional respect.

---

## 5. Licensing of Contributions

By submitting a Pull Request to this repository, you agree that your code contributions will be licensed under the **MIT License**, in accordance with the project's [`LICENSE`](./LICENSE) file.
