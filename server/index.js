// Vercel entry. Vercel's Express preset runs the first app/index/server file
// (here, then in src/) that imports express, and it compiles a TypeScript
// entry itself, resolving packages differently from `npm run build` (helmet
// fails to type-check). This plain-JS file runs what `npm run build`
// compiled to dist/ instead. A long-running server uses `npm start`.
import express from "express";
import { app, untilStarted } from "./dist/serverless.js";

export default express().disable("x-powered-by").use(untilStarted, app);
