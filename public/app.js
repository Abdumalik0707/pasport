(function () {
  "use strict";

  var form = document.getElementById("application-form");
  var btnSubmit = document.getElementById("btn-submit");
  var formStatus = document.getElementById("form-status");
  var successPanel = document.getElementById("success-panel");
  var submissionIdEl = document.getElementById("submission-id");

  var csrfToken = "";

  var PATTERNS = {
    name: /^[A-Za-zА-Яа-яЎўҚқҒғҲҳʻʼ'’\-\s]{2,60}$/u,
    fullName: /^[A-Za-zА-Яа-яЎўҚқҒғҲҳʻʼ'’\-\s]{5,160}$/u,
    passport: /^[A-Z]{2}\d{7}$/,
    pinfl: /^\d{14}$/,
    phone: /^\+?\d{7,15}(,\s*\+?\d{7,15})*$/,
    telegram: /^@?[A-Za-z0-9_]{5,32}$/,
  };

  var FILE_RULES = {
    photo3x4: { types: ["image/jpeg", "image/png", "application/pdf"], maxSize: 5 * 1024 * 1024 },
    passportScan: { types: ["application/pdf"], maxSize: 10 * 1024 * 1024 },
    diploma: { types: ["application/pdf"], maxSize: 10 * 1024 * 1024 },
    transcript: { types: ["application/pdf"], maxSize: 10 * 1024 * 1024 },
  };

  var COUNTRIES = ["O'zbekiston", "Qozog'iston", "Qirg'iziston", "Tojikiston", "Turkmaniston", "Turkiya"];

  function populateCitizenshipSelect() {
    var select = form.elements.citizenship;
    COUNTRIES.forEach(function (country, index) {
      var option = document.createElement("option");
      option.value = country;
      option.textContent = country;
      if (index === 0) option.selected = true;
      select.appendChild(option);
    });
  }

  function fetchCsrfToken() {
    return fetch("/api/csrf-token", { credentials: "same-origin" })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        csrfToken = data.csrfToken;
      })
      .catch(function () {
        setStatus("Server bilan bog'lanib bo'lmadi. Sahifani yangilang.");
      });
  }

  function setStatus(message) {
    formStatus.textContent = message || "";
  }

  function clearFieldError(name) {
    var el = form.querySelector('[data-error-for="' + name + '"]');
    var input = form.elements[name];
    if (el) el.textContent = "";
    if (input) input.classList.remove("invalid");
  }

  function setFieldError(name, message) {
    var el = form.querySelector('[data-error-for="' + name + '"]');
    var input = form.elements[name];
    if (el) el.textContent = message;
    if (input) input.classList.add("invalid");
  }

  // Kiritishni avtomatik formatlash
  ["domesticPassportNumber", "internationalPassportNumber"].forEach(function (id) {
    var el = form.elements[id];
    el.addEventListener("input", function () {
      el.value = el.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    });
  });
  ["domesticPinfl", "internationalPinfl"].forEach(function (id) {
    var el = form.elements[id];
    el.addEventListener("input", function () {
      el.value = el.value.replace(/\D/g, "");
    });
  });
  // Ism-familiya maydonlariga raqam va boshqa notog'ri belgilar kiritilishining oldini oladi
  ["firstName", "lastName", "patronymic", "fatherFullName", "motherFullName"].forEach(function (id) {
    var el = form.elements[id];
    el.addEventListener("input", function () {
      var cursor = el.selectionStart;
      var before = el.value;
      el.value = el.value.replace(/[^A-Za-zА-Яа-яЎўҚқҒғҲҳʻʼ'’\-\s]/gu, "");
      if (cursor !== null && el.value.length !== before.length) {
        cursor -= before.length - el.value.length;
      }
      if (cursor !== null) el.setSelectionRange(cursor, cursor);
    });
  });

  // --- Bir nechta telefon raqami qo'shish imkoniyati ---

  function makePhoneRow(groupName) {
    var row = document.createElement("div");
    row.className = "phone-row";

    var input = document.createElement("input");
    input.type = "tel";
    input.className = "phone-input";
    input.inputMode = "tel";
    input.maxLength = 16;
    input.placeholder = "+998901234567";
    attachPhoneDigitFilter(input);
    row.appendChild(input);

    var removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn-remove-phone";
    removeBtn.setAttribute("aria-label", "Raqamni o'chirish");
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", function () {
      row.remove();
      syncPhoneGroup(groupName);
    });
    row.appendChild(removeBtn);

    return row;
  }

  // Faqat raqam va (agar boshida bo'lsa) "+" belgisini qoldiradi — harflar kiritilmaydi
  function attachPhoneDigitFilter(input) {
    input.addEventListener("input", function () {
      var hasPlus = input.value.trim().charAt(0) === "+";
      var digits = input.value.replace(/\D/g, "").slice(0, 15);
      input.value = (hasPlus ? "+" : "") + digits;
    });
  }

  function syncPhoneGroup(groupName) {
    var container = form.querySelector('[data-phone-group="' + groupName + '"]');
    var hidden = form.elements[groupName];
    var inputs = Array.prototype.slice.call(container.querySelectorAll(".phone-input"));
    var numbers = inputs
      .map(function (input) {
        return input.value.trim();
      })
      .filter(function (value) {
        return value.length > 0;
      });
    hidden.value = numbers.join(", ");
  }

  function initPhoneGroups() {
    Array.prototype.slice.call(form.querySelectorAll(".phone-row .phone-input")).forEach(attachPhoneDigitFilter);

    Array.prototype.slice.call(form.querySelectorAll("[data-add-phone]")).forEach(function (button) {
      var groupName = button.getAttribute("data-add-phone");
      button.addEventListener("click", function () {
        var container = form.querySelector('[data-phone-group="' + groupName + '"]');
        container.appendChild(makePhoneRow(groupName));
      });
    });
  }

  function syncAllPhoneGroups() {
    ["phone", "fatherPhone", "motherPhone"].forEach(syncPhoneGroup);
  }

  function validateTextFields() {
    var valid = true;
    var textFields = [
      "firstName",
      "lastName",
      "patronymic",
      "birthDate",
      "citizenship",
      "officialAddress",
      "phone",
      "telegramUsername",
      "domesticPassportNumber",
      "domesticPinfl",
      "internationalPassportNumber",
      "internationalPinfl",
      "fatherFullName",
      "fatherPhone",
      "motherFullName",
      "motherPhone",
    ];

    textFields.forEach(function (name) {
      var field = form.elements[name];
      clearFieldError(name);
      var value = field.value.trim();

      if (field.required && !value) {
        setFieldError(name, "Bu maydon to'ldirilishi shart");
        valid = false;
        return;
      }
      if (!value) return;

      if (name === "firstName" || name === "lastName" || name === "patronymic") {
        if (!PATTERNS.name.test(value)) {
          setFieldError(name, "Faqat harflardan foydalaning");
          valid = false;
        }
      } else if (name === "fatherFullName" || name === "motherFullName") {
        if (!PATTERNS.fullName.test(value)) {
          setFieldError(name, "To'liq ism-familiyani to'g'ri kiriting");
          valid = false;
        }
      } else if (name === "domesticPassportNumber" || name === "internationalPassportNumber") {
        if (!PATTERNS.passport.test(value.toUpperCase())) {
          setFieldError(name, "AA1234567 ko'rinishida bo'lishi kerak");
          valid = false;
        }
      } else if (name === "domesticPinfl" || name === "internationalPinfl") {
        if (!PATTERNS.pinfl.test(value)) {
          setFieldError(name, "14 ta raqamdan iborat bo'lishi kerak");
          valid = false;
        }
      } else if (name === "phone" || name === "fatherPhone" || name === "motherPhone") {
        if (!PATTERNS.phone.test(value)) {
          setFieldError(name, "Telefon raqamni to'g'ri kiriting (7-15 ta raqam)");
          valid = false;
        }
      } else if (name === "telegramUsername") {
        if (!PATTERNS.telegram.test(value)) {
          setFieldError(name, "Masalan: @username");
          valid = false;
        }
      } else if (name === "birthDate") {
        if (new Date(value) >= new Date()) {
          setFieldError(name, "Tug'ilgan sana noto'g'ri");
          valid = false;
        }
      }
    });

    return valid;
  }

  function validateFiles() {
    var valid = true;
    Object.keys(FILE_RULES).forEach(function (name) {
      var field = form.elements[name];
      clearFieldError(name);
      var files = field.files ? Array.prototype.slice.call(field.files) : [];

      if (files.length === 0) {
        setFieldError(name, "Fayl talab qilinadi");
        valid = false;
        return;
      }
      var rules = FILE_RULES[name];
      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        if (rules.types.indexOf(file.type) === -1) {
          setFieldError(name, "Fayl turi noto'g'ri: " + file.name);
          valid = false;
          return;
        }
        if (file.size > rules.maxSize) {
          setFieldError(name, "Fayl hajmi juda katta: " + file.name);
          valid = false;
          return;
        }
      }
    });
    return valid;
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    syncAllPhoneGroups();
    var textOk = validateTextFields();
    var filesOk = validateFiles();

    if (!textOk || !filesOk) {
      setStatus("Iltimos, belgilangan maydonlarni to'g'ri to'ldiring.");
      var firstError = form.querySelector(".invalid");
      if (firstError) firstError.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    btnSubmit.disabled = true;
    btnSubmit.textContent = "Yuborilmoqda...";
    setStatus("");

    var send = function () {
      var formData = new FormData(form);
      return fetch("/api/apply/submit", {
        method: "POST",
        credentials: "same-origin",
        headers: { "X-CSRF-Token": csrfToken },
        body: formData,
      });
    };

    send()
      .then(function (res) {
        if (res.status === 403) {
          return fetchCsrfToken().then(send);
        }
        return res;
      })
      .then(function (res) {
        return res.json().then(function (data) {
          return { status: res.status, data: data };
        });
      })
      .then(function (result) {
        if (result.data && result.data.ok) {
          form.hidden = true;
          successPanel.hidden = false;
          submissionIdEl.textContent = result.data.submissionId || "—";
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          var fieldErrors = (result.data && result.data.fieldErrors) || {};
          Object.keys(fieldErrors).forEach(function (name) {
            var messages = fieldErrors[name];
            if (messages && messages.length) setFieldError(name, messages[0]);
          });
          setStatus((result.data && result.data.error) || "Xatolik yuz berdi. Qayta urinib ko'ring.");
        }
      })
      .catch(function () {
        setStatus("Internet aloqasi yo'q yoki server javob bermadi. Qayta urinib ko'ring.");
      })
      .finally(function () {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Ma'lumotlarni Yuborish";
      });
  });

  populateCitizenshipSelect();
  initPhoneGroups();
  fetchCsrfToken();
})();
