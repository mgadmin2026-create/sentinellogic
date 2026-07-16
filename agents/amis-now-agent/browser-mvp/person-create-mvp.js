(() => {
  const RUN_SUBMIT = false; // Erst testen. Fuer echtes Anlegen auf true setzen.
  const USE_MANUAL_ADDRESS = true;
  const STEP_DELAY_MS = 700;
  const READY_TIMEOUT_MS = 120000;

  const testPerson = {
    gender: "male",
    firstName: "Max",
    lastName: "Mustermann",
    birthDate: "01.01.1990",
    street: "Pariser Platz",
    houseNumber: "1",
    postalCode: "10115",
    city: "Berlin",
    phone: "15112345678",
    email: "max.mustermann.test@example.com",
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function allDeep(selector, root = document) {
    const results = [...root.querySelectorAll(selector)];
    const allElements = root.querySelectorAll ? [...root.querySelectorAll("*")] : [];
    for (const element of allElements) {
      if (element.shadowRoot) {
        results.push(...allDeep(selector, element.shadowRoot));
      }
    }
    return results;
  }

  function visible(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  function byText(selector, text) {
    return allDeep(selector).find((element) =>
      visible(element) && element.textContent.trim().toLowerCase().includes(text.toLowerCase())
    );
  }

  async function waitFor(label, finder, timeoutMs = READY_TIMEOUT_MS) {
    const started = Date.now();
    let lastHref = location.href;
    while (Date.now() - started < timeoutMs) {
      const found = finder();
      if (found) return found;
      if (location.href !== lastHref) {
        lastHref = location.href;
        console.log(`Warte auf ${label}: Navigation erkannt -> ${lastHref}`);
      }
      await sleep(1000);
    }
    throw new Error(`Nicht gefunden: ${label}`);
  }

  function findPlusButton() {
    return (
      allDeep("button").find((button) =>
        visible(button) && button.querySelector("nx-icon[data-nx-icon-name='plus']")
      ) ||
      allDeep("[aria-label*='Neu' i], [aria-label*='Anlegen' i], [title*='Neu' i], [title*='Anlegen' i]").find(visible) ||
      allDeep("nx-icon[data-nx-icon-name='plus'], nx-icon[name='plus'], .nx-icon--plus, [data-nx-icon-name='plus']").find(visible) ||
      allDeep("svg, path").find((element) => visible(element) && element.outerHTML.toLowerCase().includes("plus"))
    );
  }

  function find(selector) {
    const element = allDeep(selector).find(visible);
    if (!element) throw new Error(`Nicht gefunden: ${selector}`);
    return element;
  }

  function clickableParent(element) {
    let current = element;
    while (current && current !== document.body) {
      const tag = current.tagName?.toLowerCase();
      const role = current.getAttribute?.("role");
      if (tag === "button" || tag === "a" || role === "button" || role === "menuitem") return current;
      current = current.parentElement || current.getRootNode()?.host;
    }
    return element;
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function findCheckboxNearText(...needles) {
    const normalizedNeedles = needles.map(normalizeText);
    const containers = allDeep("nx-checkbox, label, div, span").filter((element) => {
      const text = normalizeText(element.textContent);
      return visible(element) && normalizedNeedles.every((needle) => text.includes(needle));
    });

    for (const container of containers) {
      const direct = container.querySelector?.("input[type='checkbox']");
      if (direct) return direct;
      const labelFor = container.getAttribute?.("for");
      if (labelFor) {
        const byId = allDeep(`#${CSS.escape(labelFor)}`)[0];
        if (byId?.matches?.("input[type='checkbox']")) return byId;
      }
      const parent = container.closest?.("nx-checkbox, label, div");
      const parentInput = parent?.querySelector?.("input[type='checkbox']");
      if (parentInput) return parentInput;
    }

    return allDeep("input[type='checkbox']").find((input) => {
      const id = input.id;
      const label = id ? allDeep(`label[for='${CSS.escape(id)}']`)[0] : null;
      return label && normalizedNeedles.every((needle) => normalizeText(label.textContent).includes(needle));
    });
  }

  function click(element, label) {
    if (!element) throw new Error(`Nicht gefunden: ${label}`);
    element = clickableParent(element);
    element.scrollIntoView({ block: "center", inline: "center" });
    element.click();
    console.log(`OK: geklickt - ${label}`);
  }

  async function setInput(selector, value) {
    const input = find(selector);
    await setElementInput(input, value, `Feld ${selector}`);
  }

  async function setElementInput(input, value, label) {
    input.scrollIntoView({ block: "center", inline: "center" });
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("blur", { bubbles: true }));
    input.blur();
    console.log(`OK: ${label} gesetzt = ${value}`);
  }

  async function setInputWithKeys(selector, value) {
    const input = find(selector);
    await setElementInputWithKeys(input, value, `Feld ${selector}`);
  }

  async function setElementInputWithKeys(input, value, label) {
    input.scrollIntoView({ block: "center", inline: "center" });
    input.focus();
    input.click();
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    document.execCommand?.("insertText", false, value);
    if (input.value !== value) {
      input.value = value;
      input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
    }
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", code: "Tab", bubbles: true }));
    input.dispatchEvent(new Event("blur", { bubbles: true }));
    input.blur();
    await sleep(250);
    console.log(`OK: ${label} per Tastatur gesetzt = ${value}`);
  }

  function findInputByLabelText(...needles) {
    const normalizedNeedles = needles.map(normalizeText);
    const labels = allDeep("label, nx-formfield-label, span").filter((element) => {
      const text = normalizeText(element.textContent);
      return visible(element) && normalizedNeedles.every((needle) => text.includes(needle));
    });

    for (const label of labels) {
      const forId = label.getAttribute?.("for") || label.closest?.("label")?.getAttribute?.("for");
      if (forId) {
        const input = allDeep(`#${CSS.escape(forId)}`)[0];
        if (input?.matches?.("input, textarea")) return input;
      }
      const field = label.closest?.("nx-formfield, div");
      const input = field?.querySelector?.("input, textarea");
      if (input) return input;
    }
    return null;
  }

  function candidateInputs() {
    return allDeep("input, textarea")
      .filter((input) => visible(input) && !input.disabled && !input.readOnly)
      .map((input) => {
        const labelId = input.getAttribute("aria-labelledby");
        const ariaLabel = input.getAttribute("aria-label") || "";
        const labelText = labelId
          ? labelId.split(/\s+/).map((id) => allDeep(`#${CSS.escape(id)}`)[0]?.textContent || "").join(" ")
          : "";
        const fieldText = input.closest("nx-formfield, div")?.textContent || "";
        return {
          input,
          text: normalizeText(`${ariaLabel} ${labelText} ${fieldText} ${input.id} ${input.name} ${input.getAttribute("formcontrolname")}`)
        };
      });
  }

  function findInputByAnyText(...needles) {
    const normalizedNeedles = needles.map(normalizeText);
    return candidateInputs().find(({ text }) => normalizedNeedles.every((needle) => text.includes(needle)))?.input || null;
  }

  async function setFirstAvailableInput(label, selectors, value) {
    for (const selector of selectors) {
      const input = allDeep(selector).find(visible);
      if (input) {
        await setElementInput(input, value, `${label} (${selector})`);
        return;
      }
    }
    throw new Error(`${label}-Feld nicht gefunden`);
  }

  async function fillManualAddress() {
    const manualButton =
      byText("button", "Adresse manuell hinzufügen") ||
      byText("span", "Adresse manuell hinzufügen")?.closest("button,[role='button'],a") ||
      allDeep("[data-test='changeDisplayModeButton']").find(visible);

    if (manualButton) {
      click(manualButton, "Adresse manuell hinzufügen");
      await sleep(STEP_DELAY_MS);
    } else {
      console.warn("Adresse manuell hinzufügen nicht gefunden. Versuche direkte manuelle Felder.");
    }

    const streetInput =
      allDeep("input#adressforminputstreet").find(visible) ||
      allDeep("input#addressforminputstreet").find(visible) ||
      allDeep("input[formcontrolname='street']").find(visible) ||
      allDeep("input[formcontrolname='streetName']").find(visible) ||
      findInputByLabelText("straße") ||
      findInputByLabelText("strasse") ||
      findInputByAnyText("straße") ||
      findInputByAnyText("strasse") ||
      findInputByAnyText("str.") ||
      findInputByAnyText("street");
    const houseNumberInput = findInputByLabelText("nr") || findInputByLabelText("hausnummer");
    const postalCodeInput = findInputByLabelText("postleitzahl") || findInputByLabelText("plz");
    const cityInput = findInputByLabelText("stadt") || findInputByLabelText("ort");

    if (streetInput) {
      await setElementInputWithKeys(streetInput, testPerson.street, "Strasse");
    } else {
      await setFirstAvailableInput("Strasse", [
        "input#adressforminputstreet",
        "input#addressforminputstreet",
        "input[formcontrolname='street']",
        "input[formcontrolname='streetText']",
        "input[formcontrolname='road']",
        "input[formcontrolname='streetName']",
        "input[name*='street' i]",
        "input[name*='strasse' i]",
        "input[id*='street' i]",
        "input[id*='strasse' i]",
        "input[id*='straße' i]",
        "input[aria-label*='Straße' i]",
        "input[aria-label*='Strasse' i]",
        "input[placeholder*='Straße' i]",
        "input[placeholder*='Strasse' i]"
      ], testPerson.street);
    }

    if (houseNumberInput) {
      await setElementInput(houseNumberInput, testPerson.houseNumber, "Hausnummer");
    } else {
      await setFirstAvailableInput("Hausnummer", [
        "input[formcontrolname='houseNumber']",
        "input[formcontrolname='streetNumber']",
        "input[name*='house' i]",
        "input[id*='house' i]",
        "input[id*='nummer' i]"
      ], testPerson.houseNumber);
    }

    if (postalCodeInput) {
      await setElementInput(postalCodeInput, testPerson.postalCode, "Postleitzahl");
    } else {
      await setFirstAvailableInput("Postleitzahl", [
        "input[formcontrolname='postalCode']",
        "input[formcontrolname='zipCode']",
        "input[name*='postal' i]",
        "input[name*='zip' i]",
        "input[id*='postal' i]",
        "input[id*='zip' i]",
        "input[id*='plz' i]"
      ], testPerson.postalCode);
    }

    if (cityInput) {
      await setElementInput(cityInput, testPerson.city, "Stadt");
    } else {
      await setFirstAvailableInput("Stadt", [
        "input[formcontrolname='city']",
        "input[formcontrolname='town']",
        "input[name*='city' i]",
        "input[name*='town' i]",
        "input[id*='city' i]",
        "input[id*='stadt' i]",
        "input[id*='ort' i]"
      ], testPerson.city);
    }
  }

  function check(selector) {
    const input = find(selector);
    input.scrollIntoView({ block: "center", inline: "center" });
    if (!input.checked) {
      input.click();
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    console.log(`OK: Checkbox/Radio gesetzt - ${selector}`);
  }

  function fillBirthDate(value) {
    const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!match) throw new Error("birthDate muss TT.MM.JJJJ sein");
    const [, day, month, year] = match;
    const root = find("#personDataFormInputBirthdate");
    const dayInput = root.querySelector("input[placeholder='tt'], input[aria-label*='Tagesfeld']");
    const monthInput = root.querySelector("input[placeholder='mm'], input[aria-label*='Monatsfeld']");
    const yearInput = root.querySelector("input[placeholder='jjjj'], input[aria-label*='Jahresfeld']");
    if (!dayInput || !monthInput || !yearInput) throw new Error("Geburtsdatum-Felder nicht gefunden");
    [
      [dayInput, day],
      [monthInput, month],
      [yearInput, year],
    ].forEach(([input, part]) => {
      input.focus();
      input.value = part;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.blur();
    });
    console.log(`OK: Geburtsdatum gesetzt - ${value}`);
  }

  async function openPersonModal() {
    console.log("Warte auf AMIS.NOW Startseite und Plus-Button...");
    const plusButton = await waitFor("Plus", findPlusButton);

    click(plusButton, "Plus");
    await sleep(STEP_DELAY_MS);

    const personAction = await waitFor("Person anlegen", () =>
      byText("button", "Person anlegen") ||
      byText("[role='menuitem']", "Person anlegen") ||
      byText("a", "Person anlegen") ||
      byText("span", "Person anlegen")?.closest("button,[role='menuitem'],a")
    );

    click(personAction, "Person anlegen");
    await sleep(STEP_DELAY_MS);

    find("nx-modal-container[role='dialog']");
    console.log("OK: Modal ist sichtbar");
  }

  async function run() {
    console.log("MVP Person anlegen gestartet", { RUN_SUBMIT, testPerson });
    await openPersonModal();

    check(testPerson.gender === "female" ? "#personDataFormRadioGender-1-input" : "#personDataFormRadioGender-0-input");
    await setInput("#personDataFormInputFirstName", testPerson.firstName);
    await setInput("#personDataFormInputName", testPerson.lastName);
    fillBirthDate(testPerson.birthDate);

    const identityCheckbox =
      findCheckboxNearText("Identität", "Person") ||
      findCheckboxNearText("Identitaet", "Person") ||
      findCheckboxNearText("gültigen", "Dokument") ||
      findCheckboxNearText("gueltigen", "Dokument") ||
      findCheckboxNearText("Ausweis");
    if (!identityCheckbox) throw new Error("Identitaets-Checkbox nicht gefunden");
    check(`#${CSS.escape(identityCheckbox.id)}`);

    if (USE_MANUAL_ADDRESS) {
      await fillManualAddress();
    } else {
      await setInput(
        "input[data-test='address-search']",
        `${testPerson.street} ${testPerson.houseNumber}, ${testPerson.postalCode} ${testPerson.city}`
      );
    }
    await setInputWithKeys("input[aria-label='Rufnummer']", testPerson.phone);
    await setInputWithKeys("#contactDataFormInputEmail-0", testPerson.email);

    if (RUN_SUBMIT) {
      click(find("nx-modal-container[role='dialog'] #submitBtn"), "Anlegen");
      console.log("OK: Anlegen geklickt");
    } else {
      console.log("TESTMODUS: Nicht auf Anlegen geklickt. Wenn alles passt, RUN_SUBMIT oben auf true setzen.");
    }
  }

  run().catch((error) => {
    console.error("MVP Fehler:", error);
    alert(`MVP Fehler: ${error.message}`);
  });
})();
