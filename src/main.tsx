import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { HelpWindow } from "./components/Help/HelpWindow";
import "./styles/globals.css";

const params = new URLSearchParams(window.location.search);
const isHelpWindow = params.get('window') === 'help';

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isHelpWindow ? <HelpWindow /> : <App />}
  </React.StrictMode>,
);
