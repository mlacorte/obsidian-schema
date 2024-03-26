/* @refresh reload */
import "./index.css";

import { Route, Router } from "@solidjs/router";
import { render } from "solid-js/web";

import { App } from "./App";

const root = document.getElementById("root");

render(
  () => (
    <Router>
      <Route path="/*" component={App} />
    </Router>
  ),
  root!
);
