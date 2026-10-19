import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// reCAPTCHA is loaded on demand by useRecaptcha (Checkout OTP and Ticket Retrieval only), so the
// Google script and its badge do not appear on Admin, Staff or /login.

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
