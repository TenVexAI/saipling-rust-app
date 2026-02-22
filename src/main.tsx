import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { HelpWindow } from "./components/Help/HelpWindow";
import { CustomThemeEditor } from "./components/Settings/CustomThemeEditor";
import "./styles/globals.css";

const params = new URLSearchParams(window.location.search);
const windowType = params.get('window');

function RootComponent() {
  if (windowType === 'help') return <HelpWindow />;
  if (windowType === 'theme-editor') return <CustomThemeEditor />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RootComponent />
  </React.StrictMode>,
);
