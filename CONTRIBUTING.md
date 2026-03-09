# Contributing to Lumaforge

First off, thank you for your interest in contributing to Lumaforge! This is a community-driven open-source project, and your contributions—whether it's optimizing the rendering pipeline, fixing UI bugs, or expanding the documentation—are highly appreciated.

## How to Contribute?

### 1. Reporting Bugs:
If you encounter a bug (e.g., rendering errors, math calculations resulting in `NaN`, or UI state issues), please open an issue in the repository.
* Check existing issues to ensure it hasn't already been reported.
* Provide clear, step-by-step instructions to reproduce the error.
* Include your browser version, operating system, and any relevant console errors.

### 2. Suggesting Enhancements:
If you have an idea for a new feature or an architectural improvement:
* Open an **Issue** to discuss your proposed changes before writing significant amounts of code.
* Ensure the feature aligns with the project's goal of remaining lightweight, professional, and optimized for browser environments.

### 3. Submitting Pull Requests:
When you are ready to submit code:
1. **Fork** the repository to your own GitHub account.
2. **Clone** your fork locally.
3. **Create a branch** for your feature or bug fix: 
   `git checkout -b feature/your-feature-name` or `fix/your-bug-name`.
4. **Commit** your changes with clear, descriptive messages (see standards below).
5. **Push** to your fork: `git push origin feature/your-feature-name`.
6. Open a **Pull Request** against the `main` branch of the original Lumaforge repository.

## Development Guidelines:

When contributing code to Lumaforge, please keep the following technical principles in mind:

* **Strict Data Validation:** The canvas rendering pipeline relies on strict numerical values. Always sanitize user inputs and safely parse steganographic metadata (e.g., handling strings vs. JSON objects) to prevent application crashes and `NaN` poisoning.
* **Performance First:** Prioritize performance and resource management. Avoid adding heavy external dependencies if a native Web API (like Canvas or Web Workers) can handle the task efficiently.
* **UI Consistency:** Maintain the existing dark mode, high-contrast aesthetic. Ensure new UI components are responsive, accessible, and align with the established design system.

## Commit Message Standards:

Please format your commit messages clearly to maintain an organized and readable project history. We recommend using standard conventional commits:

* `feat: [Description]` - For introducing new features.
* `fix: [Description]` - For bug fixes.
* `refactor: [Description]` - For code optimizations that do not change external functionality.
* `style: [Description]` - For formatting changes (CSS tweaks, removing whitespace, etc.).
* `docs: [Description]` - For updates to documentation or code comments.

---
*Thank you for helping build the future of browser-based optics!*