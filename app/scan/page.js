"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import axios from "axios";

const QrReader = dynamic(
  () => import("react-qr-reader").then((mod) => mod.default || mod.QrReader),
  {
    ssr: false,
    loading: () => <div className="scanner-placeholder">Loading camera...</div>,
  }
);

const initialStatus = "Point the camera at a visitor QR code to mark them as arrived.";

export default function ScanPage() {
  const [status, setStatus] = useState(initialStatus);
  const [tone, setTone] = useState("info");
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastValue, setLastValue] = useState("");
  const [visitDetails, setVisitDetails] = useState(null);

  const resetState = () => {
    setStatus(initialStatus);
    setTone("info");
    setVisitDetails(null);
    setLastValue("");
  };

  const handleScan = useCallback(
    async (value) => {
      if (!value || isProcessing || value === lastValue) return;

      setIsProcessing(true);
      setStatus("Checking visitor record...");
      setTone("info");
      setVisitDetails(null);
      setLastValue(value);

      try {
        const parsed = typeof value === "string" ? JSON.parse(value) : value;
        const visitId = parsed?.visitId || parsed?.id;
        const phoneNumber = parsed?.phoneNumber || parsed?.phone_number;

        if (!visitId && !phoneNumber) {
          throw new Error("QR code does not include a visit id or phone number.");
        }

        const response = await axios.post(
          "/api/visits/check-in",
          { visitId, phoneNumber },
          { headers: { "Content-Type": "application/json" } }
        );

        setVisitDetails({
          visitId: response?.data?.visitId || visitId || "",
          childName: parsed?.childName || parsed?.child_name || "",
          phoneNumber: phoneNumber || "",
          visited: response?.data?.visited ?? true,
        });
        setStatus("Visitor marked as arrived.");
        setTone("success");
      } catch (error) {
        const message =
          error?.response?.data?.error ||
          error?.message ||
          "Could not update the visit. Please try again.";
        setStatus(message);
        setTone("error");
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, lastValue]
  );

  const onResult = (result, error) => {
    if (result?.text) {
      handleScan(result.text);
    } else if (typeof result?.getText === "function") {
      handleScan(result.getText());
    }

    if (error && error.name !== "NotFoundException") {
      setStatus("Camera error. Try again or check permissions.");
      setTone("error");
    }
  };

  return (
    <>
      <header className="hero">
        <div className="brand">
          <img
            src="/assets/TMS_LOGO.png"
            alt="Saraswati Global School logo"
            className="brand-logo"
          />
          <div className="brand-copy">
            <p className="eyebrow">Visitor check-in</p>
            <h1>Scan QR to confirm arrival</h1>
            <p className="subhead">
              Open the camera, scan the guest code, and we will mark them as
              visited.
            </p>
          </div>
        </div>
      </header>

      <main className="main">
        <section className="form-card scan-card">
          <div className="scan-head">
            <div>
              <h2>Staff scanner</h2>
              <p className="lead">
                Use the device camera to validate a visitor QR code.
              </p>
            </div>
            <button type="button" onClick={resetState} disabled={isProcessing}>
              Ready for next visitor
            </button>
          </div>

          <div className="scanner-frame">
            <QrReader
              constraints={{ facingMode: "environment" }}
              delay={800}
              onScan={handleScan}
              onResult={onResult}
              onError={(error) => {
                if (error?.name !== "NotFoundException") {
                  setStatus("Camera error. Try again or check permissions.");
                  setTone("error");
                }
              }}
              style={{ width: "100%" }}
            />
          </div>

          <div className={`scan-status ${tone}`}>
            <p>{status}</p>
            {isProcessing && <p className="muted">Updating record...</p>}
          </div>

          {visitDetails && (
            <div className="scan-details">
              <div>
                <p className="label">Visit ID</p>
                <p className="value">{visitDetails.visitId || "—"}</p>
              </div>
              <div>
                <p className="label">Child name</p>
                <p className="value">
                  {visitDetails.childName || "Not provided"}
                </p>
              </div>
              <div>
                <p className="label">Phone number</p>
                <p className="value">
                  {visitDetails.phoneNumber || "Not provided"}
                </p>
              </div>
              <div>
                <p className="label">Visited</p>
                <p className="badge success">
                  {visitDetails.visited ? "Yes" : "No"}
                </p>
              </div>
            </div>
          )}

          <ul className="scan-instructions">
            <li>Grant camera permission when prompted.</li>
            <li>
              Hold the QR code inside the frame until you see a confirmation.
            </li>
            <li>
              Use "Ready for next visitor" if you need to re-scan the same code.
            </li>
          </ul>
        </section>
      </main>
    </>
  );
}
