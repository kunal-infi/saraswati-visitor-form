'use client';

import { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";

const initialFormState = {
  childName: "",
  className: "",
  phoneNumber: "",
  fatherName: "",
  email: "",
  visitorCount: "0",
};

const sanitizeFileName = (value) =>
  (value || "visitor")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/(^-|-$)/g, "") || "visitor";

export default function HomePage() {
  const [formData, setFormData] = useState(initialFormState);
  const [status, setStatus] = useState("");
  const [qrVisible, setQrVisible] = useState(false);
  const [qrValue, setQrValue] = useState("");
  const [downloadHref, setDownloadHref] = useState("");
  const [downloadName, setDownloadName] = useState("visitor-qr.png");
  const qrContainerRef = useRef(null);
  const qrSize = 220;

  const resetQr = () => {
    setQrVisible(false);
    setQrValue("");
    setDownloadHref("");
    setDownloadName("visitor-qr.png");
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setStatus("");
    resetQr();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    resetQr();

    const payload = {
      childName: formData.childName.trim(),
      className: formData.className.trim(),
      phoneNumber: formData.phoneNumber.trim(),
      fatherName: formData.fatherName.trim(),
      email: formData.email.trim(),
      visitorCount: formData.visitorCount.trim(),
      timestamp: new Date().toISOString(),
    };

    const childName = payload.childName || "your child";
    const visitorCount = payload.visitorCount || "0";
    const message = `Thank you, we have registered ${childName} with ${visitorCount} accompanying visitor(s). Your QR code is ready.`;

    try {
      setStatus("Saving your details...");
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setStatus("Could not save your details right now. Please try again.");
        return;
      }
    } catch (error) {
      console.error("Save failed", error);
      setStatus("Could not save your details right now. Please try again.");
      return;
    }

    const filename = `visitor-${sanitizeFileName(childName)}.png`;
    setDownloadName(filename);
    setQrValue(JSON.stringify(payload));
    setStatus(message);
    setQrVisible(true);
    setFormData(initialFormState);
  };

  useEffect(() => {
    if (!qrVisible || !qrValue) {
      setDownloadHref("");
      return;
    }

    const svg = qrContainerRef.current?.querySelector("svg");
    if (!svg) return;

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = qrSize;
      canvas.height = qrSize;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, qrSize, qrSize);
        ctx.drawImage(image, 0, 0, qrSize, qrSize);
        setDownloadHref(canvas.toDataURL("image/png"));
      } else {
        setDownloadHref(url);
      }

      URL.revokeObjectURL(url);
    };

    image.onerror = () => {
      setDownloadHref(url);
    };

    image.src = url;
  }, [qrVisible, qrValue, qrSize]);

  return (
    <>
      <header className="hero">
        <div className="brand">
          <img src="/assets/TMS_LOGO.png" alt="Saraswati Global School logo" className="brand-logo" />
          <div className="brand-copy">
            <p className="eyebrow">Saraswati Global School</p>
            <h1>Visitor Registration</h1>
            <p className="subhead">Let us know you're coming so we can prepare a warm welcome.</p>
          </div>
        </div>
      </header>

      <main className="main">
        <section className="form-card">
          <h2>Share your details</h2>
          <p className="lead">We use this information to plan your visit and stay in touch.</p>
          <form onSubmit={handleSubmit} autoComplete="on" noValidate>
            <div className="field">
              <label htmlFor="child-name">Name of the child</label>
              <input
                type="text"
                id="child-name"
                name="childName"
                required
                placeholder="Enter full name"
                value={formData.childName}
                onChange={handleChange}
              />
            </div>

            <div className="field">
              <label htmlFor="class">Class</label>
              <input
                type="text"
                id="class"
                name="className"
                required
                placeholder="e.g., Grade 5"
                value={formData.className}
                onChange={handleChange}
              />
            </div>

            <div className="field">
              <label htmlFor="phone">Phone number</label>
              <input
                type="tel"
                id="phone"
                name="phoneNumber"
                required
                inputMode="tel"
                pattern="[0-9+\\-() ]{7,15}"
                placeholder="+91 98765 43210"
                value={formData.phoneNumber}
                onChange={handleChange}
              />
            </div>

            <div className="field">
              <label htmlFor="father-name">Father name</label>
              <input
                type="text"
                id="father-name"
                name="fatherName"
                required
                placeholder="Enter father's full name"
                value={formData.fatherName}
                onChange={handleChange}
              />
            </div>

            <div className="field">
              <label htmlFor="email">Email address</label>
              <input
                type="email"
                id="email"
                name="email"
                required
                placeholder="name@example.com"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            <div className="field inline">
              <label htmlFor="visitors">Number of visitors accompanying</label>
              <input
                type="number"
                id="visitors"
                name="visitorCount"
                min="0"
                max="10"
                step="1"
                required
                value={formData.visitorCount}
                onChange={handleChange}
              />
            </div>

            <div className="actions">
              <button type="submit">Submit details</button>
              <p className="small-note">We’ll confirm via email or phone.</p>
            </div>

            <div id="form-status" className={status ? "visible" : ""} role="status" aria-live="polite">
              {status}
            </div>

            {qrVisible && (
              <div className="qr-card">
                <p className="qr-title">Your visitor QR code</p>
                <div className="qr-visual" ref={qrContainerRef}>
                  <QRCode
                    value={qrValue}
                    size={qrSize}
                    bgColor="#ffffff"
                    fgColor="#401c53"
                    aria-label="Visitor QR code"
                  />
                </div>
                <a
                  className="download-btn"
                  href={downloadHref || "#"}
                  download={downloadName}
                  aria-disabled={!downloadHref}
                >
                  Download QR
                </a>
              </div>
            )}
          </form>
        </section>
      </main>

      <footer className="footer">
        <p>Need help? Call the admissions desk or email us anytime.</p>
      </footer>
    </>
  );
}
