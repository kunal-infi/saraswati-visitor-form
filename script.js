document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('visit-form');
  const status = document.getElementById('form-status');
  const qrCard = document.getElementById('qr-card');
  const qrCanvas = document.getElementById('qr-canvas');
  const downloadLink = document.getElementById('download-qr');

  const clearStatus = () => {
    status.textContent = '';
    status.classList.remove('visible');
  };

  const resetQr = () => {
    if (!qrCard || !qrCanvas || !downloadLink) return;
    qrCard.hidden = true;
    const ctx = qrCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, qrCanvas.width, qrCanvas.height);
    }
    downloadLink.removeAttribute('href');
  };

  form.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', clearStatus);
    input.addEventListener('input', resetQr);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    resetQr();

    if (typeof QRCode === 'undefined') {
      status.textContent = 'Could not generate QR code right now. Please try again.';
      status.classList.add('visible');
      return;
    }

    const formData = new FormData(form);
    const childName = (formData.get('childName') || 'your child').toString().trim();
    const visitorCount = (formData.get('visitorCount') || '0').toString().trim();
    const payload = {
      childName,
      className: (formData.get('className') || '').toString().trim(),
      phoneNumber: (formData.get('phoneNumber') || '').toString().trim(),
      fatherName: (formData.get('fatherName') || '').toString().trim(),
      email: (formData.get('email') || '').toString().trim(),
      visitorCount,
      timestamp: new Date().toISOString(),
    };

    status.textContent = `Thank you, we have registered ${childName || 'your child'} with ${visitorCount} accompanying visitor(s). Your QR code is ready.`;
    status.classList.add('visible');

    const qrText = JSON.stringify(payload);
    const safeName = (childName || 'visitor').toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '') || 'visitor';
    const filename = `visitor-${safeName}.png`;

    QRCode.toCanvas(
      qrCanvas,
      qrText,
      { width: 220, margin: 2 },
      (error) => {
        if (error) {
          status.textContent = 'We could not create your QR code. Please try again.';
          return;
        }

        qrCard.hidden = false;
        downloadLink.download = filename;
        downloadLink.href = qrCanvas.toDataURL('image/png');
      }
    );

    form.reset();
  });
});
