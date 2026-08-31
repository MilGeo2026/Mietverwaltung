const authSection = document.getElementById("auth-section");
const appSection = document.getElementById("app-section");
const authForm = document.getElementById("auth-form");
const authMessage = document.getElementById("auth-message");
const appMessage = document.getElementById("app-message");
const logoutBtn = document.getElementById("logout-btn");
const propertyForm = document.getElementById("property-form");
const propertyList = document.getElementById("property-list");

function showLoggedIn(session) {
  authSection.hidden = true;
  appSection.hidden = false;
  logoutBtn.hidden = false;
  loadProperties();
}

function showLoggedOut() {
  authSection.hidden = false;
  appSection.hidden = true;
  logoutBtn.hidden = true;
  propertyList.innerHTML = "";
}

async function loadProperties() {
  appMessage.textContent = "";
  const { data, error } = await supabaseClient
    .from("properties")
    .select("id, name, address")
    .order("created_at", { ascending: false });

  if (error) {
    appMessage.textContent = "Fehler beim Laden: " + error.message;
    return;
  }

  propertyList.innerHTML = "";
  for (const property of data) {
    const li = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = property.address
      ? `${property.name} — ${property.address}`
      : property.name;

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Löschen";
    deleteBtn.addEventListener("click", () => deleteProperty(property.id));

    li.append(label, deleteBtn);
    propertyList.append(li);
  }
}

async function deleteProperty(id) {
  const { error } = await supabaseClient.from("properties").delete().eq("id", id);
  if (error) {
    appMessage.textContent = "Fehler beim Löschen: " + error.message;
    return;
  }
  loadProperties();
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  authMessage.textContent = "";
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    authMessage.textContent = error.message;
  }
});

authForm.querySelector('[data-action="signup"]').addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  authMessage.textContent = "";
  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) {
    authMessage.textContent = error.message;
  } else {
    authMessage.style.color = "#15803d";
    authMessage.textContent = "Registrierung erfolgreich. Bitte E-Mail bestätigen und anmelden.";
  }
});

logoutBtn.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
});

propertyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = document.getElementById("property-name").value;
  const address = document.getElementById("property-address").value;

  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  const { error } = await supabaseClient
    .from("properties")
    .insert({ name, address, user_id: user.id });

  if (error) {
    appMessage.textContent = "Fehler beim Speichern: " + error.message;
    return;
  }

  propertyForm.reset();
  loadProperties();
});

supabaseClient.auth.onAuthStateChange((_event, session) => {
  if (session) {
    showLoggedIn(session);
  } else {
    showLoggedOut();
  }
});

supabaseClient.auth.getSession().then(({ data: { session } }) => {
  if (session) {
    showLoggedIn(session);
  } else {
    showLoggedOut();
  }
});
