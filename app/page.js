"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import axios from "axios";
import NextImage from "next/image";

const initialFormState = {
  childName: "",
  className: "",
  phoneNumber: "",
  fatherName: "",
  email: "",
  visitorCount: "0",
  visitorType: "",
};

const sanitizeFileName = (value) =>
  (value || "visitor")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/(^-|-$)/g, "") || "visitor";

const buildDownloadName = (childName) =>
  `visitor-${sanitizeFileName(childName || "visitor")}.png`;

const normalizeVisitRecord = (record) => ({
  id: record?.id || "",
  childName: record?.childName || record?.child_name || "N/A",
  className: record?.className || record?.class_name || "N/A",
  fatherName: record?.fatherName || record?.father_name || "",
  phoneNumber: record?.phoneNumber || record?.phone_number || "",
  email: record?.email || "",
  visitorCount: record?.visitorCount ?? record?.visitor_count ?? "0",
  visitorType: record?.visitorType || record?.visitor_type || "",
  timestamp:
    record?.timestamp ||
    record?.createdAt ||
    record?.created_at ||
    new Date().toISOString(),
});

const buildQrPayload = (data) => ({
  visitId: data?.visitId || data?.id || "",
  childName: data?.childName || "N/A",
  className: data?.className || "N/A",
  fatherName: data?.fatherName || "",
  phoneNumber: data?.phoneNumber || "",
  visitorCount: `${data?.visitorCount ?? "0"}`,
  visitorType: data?.visitorType || "",
  timestamp: data?.timestamp || new Date().toISOString(),
});

export default function HomePage() {
  const [formData, setFormData] = useState(initialFormState);
  const [status, setStatus] = useState("");
  const [qrVisible, setQrVisible] = useState(false);
  const [qrValue, setQrValue] = useState("");
  const [downloadHref, setDownloadHref] = useState("");
  const [downloadName, setDownloadName] = useState("visitor-qr.png");
  const qrContainerRef = useRef(null);
  const qrSize = 220;
  const qrHeaderHeight = 92;
  const qrCanvasPadding = 16;
  const qrGap = 14;
  const qrFooterHeight = 68;
  const isParent = formData.visitorType === "Parent";

  const findExistingVisit = async (email, phoneNumber) => {
    try {
      const params = new URLSearchParams();
      if (email) params.append("email", email);
      if (phoneNumber) params.append("phoneNumber", phoneNumber);
      if (!params.toString()) return null;

      const response = await axios.get(`/api/visits?${params.toString()}`);
      return response?.data || null;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      console.error("Existing lookup failed", error);
      return null;
    }
  };

  const showQrForRecord = (record, message) => {
    const normalized = normalizeVisitRecord(record);
    const qrPayload = buildQrPayload(normalized);
    setDownloadName(buildDownloadName(normalized.childName));
    setQrValue(JSON.stringify(qrPayload));
    setStatus(message);
    setQrVisible(true);
    setFormData(initialFormState);
  };

  const resetQr = () => {
    setQrVisible(false);
    setQrValue("");
    setDownloadHref("");
    setDownloadName("visitor-qr.png");
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    if (name === "visitorType") {
      const nextIsParent = value === "Parent";
      setFormData((prev) => ({
        ...prev,
        visitorType: value,
        ...(nextIsParent
          ? {}
          : {
              childName: "",
              className: "",
            }),
      }));
      setStatus("");
      // resetQr();
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
    setStatus("");
    // resetQr();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    // resetQr();

    const contactEmail = formData.email.trim();
    const contactPhone = formData.phoneNumber.trim();

    setStatus("Checking if you are already registered...");
    const existingVisit = await findExistingVisit(contactEmail, contactPhone);
    if (existingVisit) {
      showQrForRecord(existingVisit, "You're already registered. Your QR code is ready.");
      return;
    }

    const payload = {
      childName: isParent ? formData.childName.trim() : "N/A",
      className: isParent ? formData.className.trim() : "N/A",
      phoneNumber: contactPhone,
      fatherName: isParent ? "" : formData.fatherName.trim(),
      email: contactEmail,
      visitorCount: formData.visitorCount.trim(),
      visitorType: formData.visitorType || "",
      timestamp: new Date().toISOString(),
    };

    const childName = isParent
      ? payload.childName || "your child"
      : "your visit";
    const visitorCount = payload.visitorCount || "0";
    const message = isParent
      ? `Thank you, we have registered ${childName} with ${visitorCount} accompanying visitor(s). Your QR code is ready.`
      : `Thank you, we have registered your visit with ${visitorCount} accompanying visitor(s). Your QR code is ready.`;

    let createdVisitId = "";

    try {
      setStatus("Saving your details...");
      const response = await axios.post("/api/visits", payload, {
        headers: { "Content-Type": "application/json" },
      });
      createdVisitId = response?.data?.id || "";
    } catch (error) {
      console.error("Save failed", error);
      setStatus("Could not save your details right now. Please try again.");
      return;
    }

    const qrPayload = buildQrPayload({ ...payload, visitId: createdVisitId });
    setDownloadName(buildDownloadName(childName));
    setQrValue(JSON.stringify(qrPayload));
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
    const svgBlob = new Blob([svgString], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);
    const qrImage = new Image();

    const loadImage = (src) =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      });

    qrImage.onload = async () => {
      const [headerBackground, headerLogo] = await Promise.all([
        loadImage("/assets/prav.png"),
        loadImage("/assets/TMS_LOGO.jpeg"),
      ]);

      const canvasWidth = qrSize + qrCanvasPadding * 2;
      const canvasHeight =
        qrHeaderHeight +
        qrGap +
        qrSize +
        qrGap +
        qrFooterHeight +
        qrCanvasPadding * 2;
      const canvas = document.createElement("canvas");
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        setDownloadHref(url);
        return;
      }

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      const headerX = qrCanvasPadding;
      const headerY = qrCanvasPadding;
      const headerWidth = canvasWidth - qrCanvasPadding * 2;

      ctx.fillStyle = "#f4ecfb";
      ctx.fillRect(headerX, headerY, headerWidth, qrHeaderHeight);

      if (headerBackground) {
        const scale = Math.min(
          headerWidth / headerBackground.width,
          qrHeaderHeight / headerBackground.height
        );
        const bgWidth = headerBackground.width * scale;
        const bgHeight = headerBackground.height * scale;
        const bgX = headerX + (headerWidth - bgWidth) / 2;
        const bgY = headerY + (qrHeaderHeight - bgHeight) / 2;
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.drawImage(headerBackground, bgX, bgY, bgWidth, bgHeight);
        ctx.restore();
      }

      const logoSize = 64;
      let textX = headerX + 12 + 8;

      if (headerLogo) {
        const logoX = headerX + 12;
        const logoY = headerY + (qrHeaderHeight - logoSize) / 2;
        ctx.drawImage(headerLogo, logoX, logoY, logoSize, logoSize);
        textX = logoX + logoSize + 12;
      }

      const primaryTextY = headerY + qrHeaderHeight / 2 - 2;
      ctx.fillStyle = "#2c0f3c";
      ctx.font = "bold 16px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("Saraswati Global School", textX, primaryTextY);
      ctx.font = "12px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("Visitor QR code", textX, primaryTextY + 18);

      const qrX = (canvasWidth - qrSize) / 2;
      const qrY = headerY + qrHeaderHeight + qrGap;

      ctx.fillStyle = "#f8f5fb";
      ctx.fillRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);
      ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

      const footerX = qrCanvasPadding;
      const footerY = qrY + qrSize + qrGap;
      const footerWidth = canvasWidth - qrCanvasPadding * 2;
      ctx.fillStyle = "#f8f5fb";
      ctx.fillRect(footerX, footerY, footerWidth, qrFooterHeight);
      ctx.strokeStyle = "rgba(64, 28, 83, 0.12)";
      ctx.lineWidth = 1;
      ctx.strokeRect(footerX + 0.5, footerY + 0.5, footerWidth - 1, qrFooterHeight - 1);

      ctx.fillStyle = "#2c0f3c";
      ctx.font = "bold 14px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("Show this QR at entry", footerX + 12, footerY + 26);
      ctx.font = "12px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("Issued by Saraswati Global School", footerX + 12, footerY + 46);

      setDownloadHref(canvas.toDataURL("image/png"));
      URL.revokeObjectURL(url);
    };

    qrImage.onerror = () => {
      setDownloadHref(url);
    };

    qrImage.src = url;
  }, [
    qrVisible,
    qrValue,
    qrSize,
    qrCanvasPadding,
    qrGap,
    qrHeaderHeight,
    qrFooterHeight,
  ]);

  return (
    <>
      <header className="hero">
        <div className="brand">
          <div className="brand-logos">
            <NextImage
              src="/assets/TMS_LOGO.jpeg"
              alt="Saraswati Global School logo"
              className="brand-logo primary"
              width={86}
              height={86}
            />
            <NextImage
              src="/assets/prav.png"
              alt="Pravahini logo"
              className="brand-logo secondary"
              width={118}
              height={118}
            />
          </div>
          <div className="brand-copy">
            <p className="eyebrow">Saraswati Global School</p>
            <h1>Visitor Registration</h1>
            <p className="subhead">
              Let us know you're coming so we can prepare a warm welcome.
            </p>
          </div>
        </div>
      </header>

      <main className="main">
        <section className="form-card">
          <h2>Share your details</h2>
          <p className="lead">
            We use this information to plan your visit and stay in touch.
          </p>
          <form onSubmit={handleSubmit} autoComplete="on" noValidate>
            <div className="field">
              <label htmlFor="visitor-type">I am a</label>
              <select
                id="visitor-type"
                name="visitorType"
                required
                value={formData.visitorType}
                onChange={handleChange}
              >
                <option value="" disabled>
                  Select one
                </option>
                <option value="Parent">Parent</option>
                <option value="Visitor">Visitor</option>
                <option value="Alumnus">Alumnus</option>
                <option value="Other">Other</option>
              </select>
            </div>
            {isParent && (
              <>
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
              </>
            )}

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
              <label htmlFor="father-name">
                {!isParent ? "Visitor" : "Father's"} name
              </label>
              <input
                type="text"
                id="father-name"
                name="fatherName"
                required={!isParent}
                placeholder={
                  !isParent
                    ? "Enter Visitor's full name"
                    : "Enter Father's full name"
                }
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

            <div
              id="form-status"
              className={status ? "visible" : ""}
              role="status"
              aria-live="polite"
            >
              {status}
            </div>

            {qrVisible && (
              <div className="qr-card">
                <p className="qr-title">Your visitor QR code</p>
                <div className="qr-pass">
                  <div className="qr-pass-header">
                    <div className="qr-pass-logo">
                      <NextImage
                        src="/assets/TMS_LOGO.jpeg"
                        alt="TMS logo"
                        width={52}
                        height={52}
                        className="qr-pass-logo-img"
                      />
                    </div>
                    <div className="qr-pass-copy">
                      <p className="qr-pass-eyebrow">Saraswati Global School</p>
                      <p className="qr-pass-title">Visitor QR</p>
                    </div>
                    <div className="qr-pass-badge">
                      <NextImage
                        src="/assets/prav.png"
                        alt="Pravahini mark"
                        width={72}
                        height={72}
                        className="qr-pass-badge-img"
                      />
                    </div>
                  </div>
                  <div className="qr-visual" ref={qrContainerRef}>
                    <QRCode
                      value={qrValue}
                      size={qrSize}
                      bgColor="#ffffff"
                      fgColor="#401c53"
                      aria-label="Visitor QR code"
                    />
                  </div>
                  <div className="qr-pass-footer">
                    <p className="qr-pass-footer-title">Show this QR at entry</p>
                    <p className="qr-pass-footer-note">
                      Issued by Saraswati Global School. Thank you for visiting.
                    </p>
                  </div>
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
