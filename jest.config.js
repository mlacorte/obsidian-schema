/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "es-jest",
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": "es-jest"
  }
};
