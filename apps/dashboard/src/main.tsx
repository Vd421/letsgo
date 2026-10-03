// The starting point: find the empty <div id="root"> in index.html and draw <App /> inside it.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error('index.html is missing <div id="root">');

createRoot(root).render(
  // StrictMode: extra checks while developing that warn about common React mistakes.
  <StrictMode>
    <App />
  </StrictMode>,
);
