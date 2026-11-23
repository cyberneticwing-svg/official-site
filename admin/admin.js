(() => {
  const TOKEN_KEY = "cw_admin_token";
  const API_BASE = window.location.origin;
  const titles = {
    contact: "Contact Details",
    social: "Social Media",
    services: "Services",
    team: "Our Team",
    clients: "Our Clients",
  };

  let token = localStorage.getItem(TOKEN_KEY) || "";
  let services = [];
  let team = [];
  let clients = [];

  const loginView = document.getElementById("login-view");
  const dashView = document.getElementById("dash-view");
  const statusMsg = document.getElementById("status-msg");
  const pageTitle = document.getElementById("page-title");
  const loginError = document.getElementById("login-error");
  const serverStatus = document.getElementById("server-status");

  function showLoginError(message) {
    if (!loginError) return;
    loginError.textContent = message;
    loginError.hidden = !message;
  }

  async function api(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    if (token) headers["x-admin-token"] = token;

    const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;
    const res = await fetch(fullUrl, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Don't logout during login attempts — only when an authenticated call fails
      if (res.status === 401 && !String(url).includes("/api/admin/login")) {
        logout(false);
      }
      if (res.status === 404) {
        throw new Error("API not found. Close other servers, double-click start.bat, then open http://localhost:3000/admin");
      }
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  }

  function isLocalHost() {
    const host = window.location.hostname;
    return host === "localhost" || host === "127.0.0.1";
  }

  async function checkServer() {
    if (window.location.protocol === "file:") {
      showLoginError("Do not open admin as a file. Run start.bat, then open http://localhost:3000/admin");
      if (serverStatus) {
        serverStatus.textContent = "Wrong: opened as local file";
        serverStatus.className = "server-status bad";
      }
      return false;
    }

    if (!isLocalHost()) {
      if (serverStatus) {
        serverStatus.textContent = "Admin is local-only (not available on Vercel)";
        serverStatus.className = "server-status bad";
      }
      showLoginError(
        "Admin does not run on Vercel. On your PC: double-click start.bat, then open http://localhost:3000/admin to edit. Push changes to update the live site."
      );
      const form = document.getElementById("login-form");
      if (form) {
        form.querySelectorAll("input, button").forEach((el) => {
          el.disabled = true;
        });
      }
      return false;
    }

    try {
      const res = await fetch(`${API_BASE}/api/site`);
      if (!res.ok) throw new Error("bad");
      if (serverStatus) {
        serverStatus.textContent = `Server connected (${API_BASE})`;
        serverStatus.className = "server-status ok";
      }
      showLoginError("");
      return true;
    } catch {
      if (serverStatus) {
        serverStatus.textContent = "Server not connected";
        serverStatus.className = "server-status bad";
      }
      showLoginError("Server not running. Double-click start.bat, wait for it to start, then refresh this page.");
      return false;
    }
  }

  function setStatus(message, isError = false) {
    statusMsg.textContent = message || "";
    statusMsg.style.color = isError ? "#b91c1c" : "#38898a";
    if (message) {
      setTimeout(() => {
        if (statusMsg.textContent === message) statusMsg.textContent = "";
      }, 3200);
    }
  }

  function showDash() {
    loginView.hidden = true;
    dashView.hidden = false;
  }

  function showLogin() {
    dashView.hidden = true;
    loginView.hidden = false;
  }

  function logout(callApi = true) {
    if (callApi && token) {
      api("/api/admin/logout", { method: "POST" }).catch(() => {});
    }
    token = "";
    localStorage.removeItem(TOKEN_KEY);
    showLogin();
  }

  async function boot() {
    showLogin();
    const ready = await checkServer();
    if (!ready) return;

    if (!token) return;

    try {
      await api("/api/admin/me");
      showDash();
      await loadAll();
    } catch {
      logout(false);
    }
  }

  async function loadAll() {
    const site = await api("/api/site");
    fillForm(document.getElementById("contact-form"), site.contact);
    fillForm(document.getElementById("social-form"), site.social);
    services = site.services || [];
    team = site.team || [];
    clients = site.clients || [];
    const showClients = site.settings?.showClients !== false;
    const toggle = document.getElementById("show-clients-toggle");
    if (toggle) toggle.checked = showClients;
    renderServices();
    renderTeam();
    renderClients();
  }

  function fillForm(form, data) {
    if (!form || !data) return;
    Object.keys(data).forEach((key) => {
      const field = form.elements.namedItem(key);
      if (field && field.type !== "file" && field.type !== "checkbox") {
        field.value = data[key] ?? "";
      }
    });
  }

  // Tabs
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
      pageTitle.textContent = titles[btn.dataset.tab];
    });
  });

  // Login
  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    showLoginError("");
    const ready = await checkServer();
    if (!ready) return;

    const username = document.getElementById("login-user").value.trim();
    const password = document.getElementById("login-pass").value.trim();

    try {
      const data = await api("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      if (!data.token) {
        throw new Error("Login failed: no token received");
      }

      token = data.token;
      localStorage.setItem(TOKEN_KEY, token);
      showDash();

      try {
        await loadAll();
        setStatus("Welcome back");
      } catch (loadErr) {
        setStatus(loadErr.message || "Logged in, but failed to load data", true);
      }
    } catch (ex) {
      token = "";
      localStorage.removeItem(TOKEN_KEY);
      showLogin();
      showLoginError(ex.message || "Login failed");
    }
  });

  document.getElementById("logout-btn").addEventListener("click", () => logout(true));

  // Contact
  document.getElementById("contact-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      await api("/api/admin/contact", { method: "PUT", body: JSON.stringify(payload) });
      setStatus("Contact details saved");
    } catch (ex) {
      setStatus(ex.message, true);
    }
  });

  // Social
  document.getElementById("social-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try {
      await api("/api/admin/social", { method: "PUT", body: JSON.stringify(payload) });
      setStatus("Social links saved");
    } catch (ex) {
      setStatus(ex.message, true);
    }
  });

  // Services
  const serviceDialog = document.getElementById("service-dialog");
  const serviceForm = document.getElementById("service-form");

  function renderServices() {
    const list = document.getElementById("services-list");
    if (!services.length) {
      list.innerHTML = `<div class="card"><p class="meta">No services yet. Click “Add Service”.</p></div>`;
      return;
    }
    list.innerHTML = services
      .map(
        (s) => `
      <article class="card">
        <div class="card-head">
          <div>
            <h3>${escapeHtml(s.title)}</h3>
            <p class="meta">${escapeHtml(s.subtitle || s.id)}</p>
          </div>
          <div class="card-actions">
            <button type="button" data-edit-service="${s.id}">Edit</button>
            <button type="button" class="danger" data-del-service="${s.id}">Delete</button>
          </div>
        </div>
        <p>${escapeHtml(s.description || "")}</p>
      </article>`
      )
      .join("");
  }

  document.getElementById("add-service-btn").addEventListener("click", () => {
    serviceForm.reset();
    serviceForm.editId.value = "";
    serviceForm.id.disabled = false;
    document.getElementById("service-dialog-title").textContent = "Add Service";
    serviceDialog.showModal();
  });

  document.getElementById("cancel-service").addEventListener("click", () => serviceDialog.close());

  document.getElementById("services-list").addEventListener("click", async (e) => {
    const editId = e.target.getAttribute("data-edit-service");
    const delId = e.target.getAttribute("data-del-service");

    if (editId) {
      const s = services.find((x) => x.id === editId);
      if (!s) return;
      serviceForm.editId.value = s.id;
      serviceForm.id.value = s.id;
      serviceForm.id.disabled = true;
      serviceForm.title.value = s.title || "";
      serviceForm.subtitle.value = s.subtitle || "";
      serviceForm.description.value = s.description || "";
      serviceForm.features.value = (s.features || []).join("\n");
      serviceForm.benefits.value = (s.benefits || []).join("\n");
      serviceForm.idealFor.value = s.idealFor || "";
      serviceForm.cta.value = s.cta || "";
      document.getElementById("service-dialog-title").textContent = "Edit Service";
      serviceDialog.showModal();
    }

    if (delId) {
      if (!confirm("Delete this service?")) return;
      try {
        await api(`/api/admin/services/${delId}`, { method: "DELETE" });
        services = services.filter((s) => s.id !== delId);
        renderServices();
        setStatus("Service deleted");
      } catch (ex) {
        setStatus(ex.message, true);
      }
    }
  });

  serviceForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(serviceForm);
    const payload = {
      id: fd.get("id"),
      title: fd.get("title"),
      subtitle: fd.get("subtitle"),
      description: fd.get("description"),
      features: String(fd.get("features") || ""),
      benefits: String(fd.get("benefits") || ""),
      idealFor: fd.get("idealFor"),
      cta: fd.get("cta"),
    };
    const editId = fd.get("editId");

    try {
      if (editId) {
        const updated = await api(`/api/admin/services/${editId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        services = services.map((s) => (s.id === editId ? updated : s));
        setStatus("Service updated");
      } else {
        const created = await api("/api/admin/services", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        services.push(created);
        setStatus("Service added");
      }
      renderServices();
      serviceDialog.close();
    } catch (ex) {
      setStatus(ex.message, true);
    }
  });

  // Team
  const teamDialog = document.getElementById("team-dialog");
  const teamForm = document.getElementById("team-form");
  const photoPreview = document.getElementById("team-photo-preview");

  function renderTeam() {
    const list = document.getElementById("team-list");
    if (!team.length) {
      list.innerHTML = `<div class="card"><p class="meta">No team members yet. Click “Add Team Member”.</p></div>`;
      return;
    }
    list.innerHTML = team
      .map((m) => {
        const photo = m.photo
          ? `<img src="${escapeAttr(m.photo)}" alt="${escapeAttr(m.name)}" />`
          : `<div class="avatar-fallback">${escapeHtml(initials(m.name))}</div>`;
        return `
        <article class="card">
          <div class="team-card-row">
            ${photo}
            <div>
              <h3>${escapeHtml(m.name)}${m.isLead ? " ★" : ""}</h3>
              <p class="meta">${escapeHtml(m.role || "")}</p>
              <p>${escapeHtml(m.bio || "")}</p>
            </div>
            <div class="card-actions">
              <button type="button" data-edit-team="${m.id}">Edit</button>
              <button type="button" class="danger" data-del-team="${m.id}">Delete</button>
            </div>
          </div>
        </article>`;
      })
      .join("");
  }

  document.getElementById("add-team-btn").addEventListener("click", () => {
    teamForm.reset();
    teamForm.editId.value = "";
    photoPreview.hidden = true;
    photoPreview.innerHTML = "";
    document.getElementById("team-dialog-title").textContent = "Add Team Member";
    teamDialog.showModal();
  });

  document.getElementById("cancel-team").addEventListener("click", () => teamDialog.close());

  teamForm.photo.addEventListener("change", () => {
    const file = teamForm.photo.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    photoPreview.hidden = false;
    photoPreview.innerHTML = `<img src="${url}" alt="Preview" />`;
  });

  document.getElementById("team-list").addEventListener("click", async (e) => {
    const editId = e.target.getAttribute("data-edit-team");
    const delId = e.target.getAttribute("data-del-team");

    if (editId) {
      const m = team.find((x) => x.id === editId);
      if (!m) return;
      teamForm.reset();
      teamForm.editId.value = m.id;
      teamForm.name.value = m.name || "";
      teamForm.role.value = m.role || "";
      teamForm.bio.value = m.bio || "";
      teamForm.isLead.checked = !!m.isLead;
      if (m.photo) {
        photoPreview.hidden = false;
        photoPreview.innerHTML = `<img src="${escapeAttr(m.photo)}" alt="" />`;
      } else {
        photoPreview.hidden = true;
        photoPreview.innerHTML = "";
      }
      document.getElementById("team-dialog-title").textContent = "Edit Team Member";
      teamDialog.showModal();
    }

    if (delId) {
      if (!confirm("Delete this team member?")) return;
      try {
        await api(`/api/admin/team/${delId}`, { method: "DELETE" });
        team = team.filter((m) => m.id !== delId);
        renderTeam();
        setStatus("Team member deleted");
      } catch (ex) {
        setStatus(ex.message, true);
      }
    }
  });

  teamForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(teamForm);
    const editId = fd.get("editId");
    const body = new FormData();
    body.append("name", fd.get("name"));
    body.append("role", fd.get("role"));
    body.append("bio", fd.get("bio"));
    body.append("isLead", teamForm.isLead.checked ? "true" : "false");
    if (teamForm.photo.files[0]) body.append("photo", teamForm.photo.files[0]);

    try {
      if (editId) {
        const updated = await api(`/api/admin/team/${editId}`, { method: "PUT", body });
        team = team.map((m) => (m.id === editId ? updated : m));
        setStatus("Team member updated");
      } else {
        const created = await api("/api/admin/team", { method: "POST", body });
        team.push(created);
        setStatus("Team member added");
      }
      renderTeam();
      teamDialog.close();
    } catch (ex) {
      setStatus(ex.message, true);
    }
  });

  // Clients visibility
  document.getElementById("clients-visibility-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const showClients = document.getElementById("show-clients-toggle").checked;
    try {
      await api("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ showClients }),
      });
      setStatus(showClients ? "Our Clients section is now visible on the website" : "Our Clients section is now hidden on the website");
    } catch (ex) {
      setStatus(ex.message, true);
    }
  });

  // Clients
  const clientDialog = document.getElementById("client-dialog");
  const clientForm = document.getElementById("client-form");
  const clientLogoPreview = document.getElementById("client-logo-preview");

  function renderClients() {
    const list = document.getElementById("clients-list");
    if (!list) return;
    if (!clients.length) {
      list.innerHTML = `<div class="card"><p class="meta">No clients yet. Click “Add Client”.</p></div>`;
      return;
    }
    list.innerHTML = clients
      .map((c) => {
        const logo = c.logo
          ? `<img src="${escapeAttr(c.logo)}" alt="${escapeAttr(c.name)}" />`
          : `<div class="avatar-fallback">${escapeHtml(initials(c.name))}</div>`;
        return `
        <article class="card">
          <div class="team-card-row">
            ${logo}
            <div>
              <h3>${escapeHtml(c.name)}</h3>
              <p class="meta">${escapeHtml(c.industry || "")}</p>
              <p>${escapeHtml(c.description || "")}</p>
              ${c.website ? `<p class="meta"><a href="${escapeAttr(c.website)}" target="_blank" rel="noopener">${escapeHtml(c.website)}</a></p>` : ""}
            </div>
            <div class="card-actions">
              <button type="button" data-edit-client="${c.id}">Edit</button>
              <button type="button" class="danger" data-del-client="${c.id}">Delete</button>
            </div>
          </div>
        </article>`;
      })
      .join("");
  }

  document.getElementById("add-client-btn").addEventListener("click", () => {
    clientForm.reset();
    clientForm.editId.value = "";
    clientLogoPreview.hidden = true;
    clientLogoPreview.innerHTML = "";
    document.getElementById("client-dialog-title").textContent = "Add Client";
    clientDialog.showModal();
  });

  document.getElementById("cancel-client").addEventListener("click", () => clientDialog.close());

  clientForm.logo.addEventListener("change", () => {
    const file = clientForm.logo.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    clientLogoPreview.hidden = false;
    clientLogoPreview.innerHTML = `<img src="${url}" alt="Preview" />`;
  });

  document.getElementById("clients-list").addEventListener("click", async (e) => {
    const editId = e.target.getAttribute("data-edit-client");
    const delId = e.target.getAttribute("data-del-client");

    if (editId) {
      const c = clients.find((x) => x.id === editId);
      if (!c) return;
      clientForm.reset();
      clientForm.editId.value = c.id;
      clientForm.name.value = c.name || "";
      clientForm.industry.value = c.industry || "";
      clientForm.description.value = c.description || "";
      clientForm.website.value = c.website || "";
      if (c.logo) {
        clientLogoPreview.hidden = false;
        clientLogoPreview.innerHTML = `<img src="${escapeAttr(c.logo)}" alt="" />`;
      } else {
        clientLogoPreview.hidden = true;
        clientLogoPreview.innerHTML = "";
      }
      document.getElementById("client-dialog-title").textContent = "Edit Client";
      clientDialog.showModal();
    }

    if (delId) {
      if (!confirm("Delete this client?")) return;
      try {
        await api(`/api/admin/clients/${delId}`, { method: "DELETE" });
        clients = clients.filter((c) => c.id !== delId);
        renderClients();
        setStatus("Client deleted");
      } catch (ex) {
        setStatus(ex.message, true);
      }
    }
  });

  clientForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(clientForm);
    const editId = fd.get("editId");
    const body = new FormData();
    body.append("name", fd.get("name"));
    body.append("industry", fd.get("industry"));
    body.append("description", fd.get("description"));
    body.append("website", fd.get("website"));
    if (clientForm.logo.files[0]) body.append("logo", clientForm.logo.files[0]);

    try {
      if (editId) {
        const updated = await api(`/api/admin/clients/${editId}`, { method: "PUT", body });
        clients = clients.map((c) => (c.id === editId ? updated : c));
        setStatus("Client updated");
      } else {
        const created = await api("/api/admin/clients", { method: "POST", body });
        clients.push(created);
        setStatus("Client added");
      }
      renderClients();
      clientDialog.close();
    } catch (ex) {
      setStatus(ex.message, true);
    }
  });

  function initials(name) {
    return String(name || "?")
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, "&#39;");
  }

  boot();
})();
