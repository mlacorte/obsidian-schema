module.exports = {
  roots: ["<rootDir>"],
  transform: {
    "^.+\\.tsx?$": "esbuild-jest-transform"
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  modulePathIgnorePatterns: [
    "<rootDir>/test/__fixtures__",
    "<rootDir>/node_modules",
    "<rootDir>/dist"
  ]
};
