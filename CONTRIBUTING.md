# Contributing to LUMAFORGE

First off, thank you for considering contributing to LUMAFORGE! It's people like you that make the open-source community such an incredible place to build, learn, and iterate.

LUMAFORGE is a high-performance, browser-native digital darkroom. Because we handle millions of pixel calculations per frame, we maintain strict architectural and performance standards. Please review these guidelines before submitting a Pull Request.

---

## 🏗️ Architectural Guidelines & Best Practices

### 1. The Core Engine (`src/components/Engine`)
The optics engine is the heart of LUMAFORGE. When modifying files like `CorePipeline.js` or `LUTSystem.js`:
* **The Pixel Loop is Sacred:** The main `for` loops in the pipeline iterate millions of times per render. **Do not** instantiate new objects, arrays, or complex functions inside these loops. Pre-calculate math outside the loop whenever possible.
* **Bitwise & Typed Arrays:** Favor `Uint8ClampedArray` and bitwise operations for color math over standard floating-point arrays where applicable to maintain memory efficiency.
* **Non-Destructive Routing:** Always preserve the source negative. Geometry (crop/rotate) should be applied via Canvas Transform Matrices, not by deleting source pixels.

### 2. The UI & React State (`src/components/UI`)
* **Memoization is Mandatory:** The canvas engine is extremely heavy. You must use `useMemo` and `useCallback` to prevent unnecessary re-renders of the `ImageStage` when users are just toggling UI elements.
* **Terminal Brutalism:** Keep the CSS pure. We do not use Tailwind, Bootstrap, or heavy component libraries. Stick to the vanilla CSS variables defined in `index.css` to maintain the industrial, retro-tech aesthetic.

---

## 🚀 How to Contribute

### 1. Reporting Bugs
If you find a bug, please open an Issue on GitHub and include:
* A clear description of the problem.
* Steps to reproduce the bug.
* Your browser and OS version.
* If it's a rendering bug, please attach the `.png` file containing the steganographic payload so we can recreate the exact mathematical state.

### 2. Proposing Features
Want to add a new film emulation, a split-toning tool, or a new LUT parser?
* **Open an Issue first:** Describe the feature and how it fits into the current optics engine. Let's discuss the math and UI approach before you spend hours coding!

### 3. Pull Request Process
1. **Fork the repository** and create your branch from `main`.
2. **Name your branch descriptively:** `feat/add-kodak-lut` or `fix/halation-memory-leak`.
3. **Write clean, documented code:** Ensure any complex math includes comments explaining the formulas.
4. **Test your changes:** Verify that your feature doesn't break the base export pipeline or the Steganographic metadata injection.
5. **Submit your PR:**
   * Provide a clear summary of the changes.
   * If your PR changes the UI or rendering output, **you must include Before & After screenshots**.

---

## 📝 Commit Message Convention
We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification for versioning clarity:
* `feat:` A new feature (e.g., `feat: add trilinear interpolation for LUTs`)
* `fix:` A bug fix (e.g., `fix: prevent divide-by-zero in curves math`)
* `docs:` Documentation changes
* `style:` Code formatting (no logic changes)
* `refactor:` Code restructuring without changing behavior

---

By contributing, you agree that your contributions will be licensed under its MIT License. Thank you for helping us build the ultimate web-based optics engine!