(function () {
  var STORAGE_KEY = "tfa-reading-log-v1";

  function loadStore() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
        profile: { memberName: "", memberEmail: "", chapter: "" },
        activeProgram: "",
        logs: {}
      };
    } catch (e) {
      return {
        profile: { memberName: "", memberEmail: "", chapter: "" },
        activeProgram: "",
        logs: {}
      };
    }
  }

  function saveStore(store) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function getEntryKey(weekNumber, url) {
    return "w" + weekNumber + "::" + url;
  }

  function getWeekKey(weekNumber) {
    return "w" + weekNumber;
  }

  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function formatDate(isoString) {
    if (!isoString) return "—";
    var date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString();
  }

  function escAttr(str) {
    return String(str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function escHtml(str) {
    return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function countProgress(program, log) {
    var total = 0;
    var completed = 0;
    program.weeks.forEach(function (week) {
      week.documents.forEach(function (doc) {
        total += 1;
        var entry = log.entries[getEntryKey(week.number, doc.url)];
        if (entry && entry.status === "completed") completed += 1;
      });
    });
    return { total: total, completed: completed };
  }

  /* ── Custom-source type label ── */
  var CS_TYPE_LABELS = { book: "Book", article: "Article", website: "Website", other: "Other" };

  function csTypeLabel(type) {
    return CS_TYPE_LABELS[type] || "Other";
  }

  /* ── Build the custom-sources HTML block for one week ── */
  function buildCustomSourcesHtml(weekNumber, log) {
    var wk = getWeekKey(weekNumber);
    var sources = (log.customSources && log.customSources[wk]) || [];

    var listHtml = sources.length
      ? sources.map(function (src) {
          var titleDisplay = src.url
            ? '<a href="' + escAttr(src.url) + '" target="_blank" rel="noopener">' + escHtml(src.title) + '</a>'
            : escHtml(src.title);
          return ''
            + '<li class="cs-item" data-cs-id="' + escAttr(src.id) + '" data-cs-week="' + wk + '">'
            + '<span class="cs-badge cs-badge--' + escAttr(src.type) + '">' + csTypeLabel(src.type) + '</span> '
            + '<span class="cs-title">' + titleDisplay + '</span>'
            + (src.notes ? ' <span class="cs-notes">— ' + escHtml(src.notes) + '</span>' : '')
            + ' <span class="cs-meta">Added ' + formatDate(src.addedAt) + '</span>'
            + ' <button type="button" class="cs-remove-btn" data-cs-remove="' + escAttr(src.id) + '" data-cs-week="' + wk + '" title="Remove">✕</button>'
            + '</li>';
        }).join("")
      : '<li class="cs-empty">No custom sources added yet.</li>';

    return ''
      + '<div class="custom-sources-block" id="csBlock-' + wk + '">'
      + '<div class="cs-header">'
      + '<span class="cs-header-icon">📚</span>'
      + '<span class="cs-header-title">Custom Sources</span>'
      + '<span class="cs-header-sub">Add your own books, articles, or websites for this week.</span>'
      + '</div>'
      + '<ul class="cs-list" id="csList-' + wk + '">' + listHtml + '</ul>'
      + '<div class="cs-form" id="csForm-' + wk + '">'
      + '<input type="text"'
      +   ' class="cs-input cs-input--title"'
      +   ' placeholder="Title / Book / Article name *"'
      +   ' data-cs-title="' + wk + '"'
      +   ' maxlength="200"'
      + '/>'
      + '<input type="url"'
      +   ' class="cs-input cs-input--url"'
      +   ' placeholder="URL (optional)"'
      +   ' data-cs-url="' + wk + '"'
      + '/>'
      + '<select class="cs-select" data-cs-type="' + wk + '">'
      + '<option value="book">Book</option>'
      + '<option value="article">Article</option>'
      + '<option value="website">Website</option>'
      + '<option value="other">Other</option>'
      + '</select>'
      + '<input type="text"'
      +   ' class="cs-input cs-input--notes"'
      +   ' placeholder="Notes (optional)"'
      +   ' data-cs-notes="' + wk + '"'
      +   ' maxlength="300"'
      + '/>'
      + '<button type="button" class="cs-add-btn" data-cs-add="' + wk + '">+ Add Source</button>'
      + '</div>'
      + '</div>';
  }

  /* ── Build the server-sync payload from local store ── */
  function buildSyncPayload(program, log) {
    var totalDocs     = 0;
    var completedDocs = 0;

    var weeks = program.weeks.map(function (week) {
      var documents = week.documents.map(function (doc) {
        var key   = getEntryKey(week.number, doc.url);
        var entry = log.entries[key] || { status: "not_started", openCount: 0, lastOpenedAt: "", notes: "" };
        totalDocs += 1;
        if (entry.status === "completed") completedDocs += 1;
        return {
          title:        doc.title,
          url:          doc.url,
          status:       entry.status       || "not_started",
          openCount:    entry.openCount    || 0,
          lastOpenedAt: entry.lastOpenedAt || null,
          notes:        entry.notes        || ""
        };
      });

      /* Include any custom sources for this week */
      var wk = getWeekKey(week.number);
      var customSources = (log.customSources && log.customSources[wk]) || [];

      return {
        weekNumber:    week.number,
        title:         week.title,
        documents:     documents,
        customSources: customSources
      };
    });

    var completionPct = totalDocs ? Math.round((completedDocs / totalDocs) * 100) : 0;

    return {
      weeks: weeks,
      summary: {
        totalDocs:     totalDocs,
        completedDocs: completedDocs,
        completionPct: completionPct
      }
    };
  }

  document.addEventListener("DOMContentLoaded", function () {
    var store = loadStore();
    var programs = (window.ACADEMY_READING_DATA && window.ACADEMY_READING_DATA.programs) || [];

    var memberName    = document.getElementById("memberName");
    var memberEmail   = document.getElementById("memberEmail");
    var chapter       = document.getElementById("chapter");
    var programSelect = document.getElementById("programSelect");
    var progressText  = document.getElementById("progressText");
    var progressBar   = document.getElementById("progressBar");
    var weeksContainer = document.getElementById("weeksContainer");
    var exportBtn     = document.getElementById("exportJsonBtn");
    var submitBtn     = document.getElementById("submitToSmBtn");
    var resetBtn      = document.getElementById("resetProgramBtn");
    var staticNote    = document.getElementById("staticNote");
    var submitStatus  = document.getElementById("submitStatus");

    memberName.value  = store.profile.memberName  || "";
    memberEmail.value = store.profile.memberEmail || "";
    chapter.value     = store.profile.chapter     || "";

    programSelect.innerHTML = programs.map(function (program) {
      return '<option value="' + program.slug + '">' + program.title + "</option>";
    }).join("");

    if (!store.activeProgram && programs[0]) {
      store.activeProgram = programs[0].slug;
    }
    programSelect.value = store.activeProgram;

    function ensureProgramLog(slug) {
      if (!store.logs[slug]) {
        store.logs[slug] = {
          updatedAt: "",
          entries: {},
          customSources: {}
        };
      }
      /* back-fill customSources onto logs created before this feature */
      if (!store.logs[slug].customSources) {
        store.logs[slug].customSources = {};
      }
      return store.logs[slug];
    }

    function persistProfile() {
      store.profile.memberName  = memberName.value.trim();
      store.profile.memberEmail = memberEmail.value.trim();
      store.profile.chapter     = chapter.value.trim();
      saveStore(store);
    }

    function render() {
      store.activeProgram = programSelect.value;
      var program = window.getAcademyProgramBySlug(store.activeProgram);
      if (!program) return;
      var log = ensureProgramLog(program.slug);
      saveStore(store);

      var progress = countProgress(program, log);
      var pct = progress.total ? Math.round((progress.completed / progress.total) * 100) : 0;
      progressText.textContent = progress.completed + " / " + progress.total + " documents completed (" + pct + "%)";
      progressBar.style.width = pct + "%";

      weeksContainer.innerHTML = program.weeks.map(function (week) {
        var docsHtml = week.documents.map(function (doc) {
          var key = getEntryKey(week.number, doc.url);
          var entry = log.entries[key] || { status: "not_started", openCount: 0, lastOpenedAt: "", notes: "" };
          return ""
            + "<tr>"
            + '<td><a href="' + doc.url + '" target="_blank" rel="noopener" data-open-doc="' + encodeURIComponent(key) + '">' + doc.title + "</a></td>"
            + '<td><select data-status="' + encodeURIComponent(key) + '">'
            + '<option value="not_started"' + (entry.status === "not_started" ? " selected" : "") + ">Not started</option>"
            + '<option value="in_progress"'  + (entry.status === "in_progress"  ? " selected" : "") + ">In progress</option>"
            + '<option value="completed"'    + (entry.status === "completed"    ? " selected" : "") + ">Completed</option>"
            + "</select></td>"
            + "<td>" + entry.openCount + "</td>"
            + "<td>" + formatDate(entry.lastOpenedAt) + "</td>"
            + '<td><input type="text" value="' + escAttr(entry.notes || "") + '" placeholder="Optional note" data-notes="' + encodeURIComponent(key) + '" /></td>'
            + "</tr>";
        }).join("");

        return ""
          + '<section class="log-card">'
          + "<h3>Week " + week.number + " — " + week.title + "</h3>"
          + '<table class="reading-table">'
          + "<thead><tr><th>Document</th><th>Status</th><th>Opened</th><th>Last Opened</th><th>Notes</th></tr></thead>"
          + "<tbody>" + docsHtml + "</tbody></table>"
          + buildCustomSourcesHtml(week.number, log)
          + "</section>";
      }).join("");

      bindInteractions(program, log);
    }

    function bindInteractions(program, log) {
      /* ── Required reading document links ── */
      Array.prototype.slice.call(document.querySelectorAll("[data-open-doc]")).forEach(function (link) {
        link.addEventListener("click", function () {
          var key = decodeURIComponent(link.getAttribute("data-open-doc"));
          var entry = log.entries[key] || { status: "not_started", openCount: 0, lastOpenedAt: "", notes: "" };
          entry.openCount = (entry.openCount || 0) + 1;
          entry.lastOpenedAt = new Date().toISOString();
          if (entry.status === "not_started") entry.status = "in_progress";
          log.entries[key] = entry;
          log.updatedAt = new Date().toISOString();
          saveStore(store);
          render();
        });
      });

      /* ── Status selects ── */
      Array.prototype.slice.call(document.querySelectorAll("[data-status]")).forEach(function (select) {
        select.addEventListener("change", function () {
          var key = decodeURIComponent(select.getAttribute("data-status"));
          var entry = log.entries[key] || { status: "not_started", openCount: 0, lastOpenedAt: "", notes: "" };
          entry.status = select.value;
          log.entries[key] = entry;
          log.updatedAt = new Date().toISOString();
          saveStore(store);
          render();
        });
      });

      /* ── Notes inputs ── */
      Array.prototype.slice.call(document.querySelectorAll("[data-notes]")).forEach(function (input) {
        input.addEventListener("change", function () {
          var key = decodeURIComponent(input.getAttribute("data-notes"));
          var entry = log.entries[key] || { status: "not_started", openCount: 0, lastOpenedAt: "", notes: "" };
          entry.notes = input.value.trim();
          log.entries[key] = entry;
          log.updatedAt = new Date().toISOString();
          saveStore(store);
        });
      });

      /* ── Custom source: Add ── */
      Array.prototype.slice.call(document.querySelectorAll("[data-cs-add]")).forEach(function (btn) {
        btn.addEventListener("click", function () {
          var wk      = btn.getAttribute("data-cs-add");
          var titleEl = document.querySelector('[data-cs-title="' + wk + '"]');
          var urlEl   = document.querySelector('[data-cs-url="'   + wk + '"]');
          var typeEl  = document.querySelector('[data-cs-type="'  + wk + '"]');
          var notesEl = document.querySelector('[data-cs-notes="' + wk + '"]');

          var title = titleEl ? titleEl.value.trim() : "";
          if (!title) {
            if (titleEl) {
              titleEl.focus();
              titleEl.style.borderColor = "#c0392b";
              setTimeout(function () { titleEl.style.borderColor = ""; }, 1500);
            }
            return;
          }

          var rawUrl = urlEl ? urlEl.value.trim() : "";
          /* Accept bare domains — prefix https:// if no protocol supplied */
          if (rawUrl && !/^https?:\/\//i.test(rawUrl)) {
            rawUrl = "https://" + rawUrl;
          }

          var newEntry = {
            id:      genId(),
            title:   title,
            url:     rawUrl,
            type:    typeEl  ? typeEl.value  : "other",
            notes:   notesEl ? notesEl.value.trim() : "",
            addedAt: new Date().toISOString()
          };

          if (!log.customSources[wk]) log.customSources[wk] = [];
          log.customSources[wk].push(newEntry);
          log.updatedAt = new Date().toISOString();
          saveStore(store);

          /* Clear inputs */
          if (titleEl) titleEl.value = "";
          if (urlEl)   urlEl.value   = "";
          if (notesEl) notesEl.value = "";

          /* Re-render only the custom sources list (avoids losing focus on other fields) */
          var listEl = document.getElementById("csList-" + wk);
          if (listEl) {
            listEl.outerHTML = buildCustomSourcesHtml(
              parseInt(wk.replace("w", ""), 10),
              log
            ).match(/<ul class="cs-list"[^>]*>[\s\S]*?<\/ul>/)[0];
          } else {
            render();
            return;
          }
          /* Re-bind just the new remove buttons */
          bindCsRemove(log);
        });
      });

      /* ── Custom source: Remove ── */
      bindCsRemove(log);
    }

    function bindCsRemove(log) {
      Array.prototype.slice.call(document.querySelectorAll("[data-cs-remove]")).forEach(function (btn) {
        /* Guard against double-binding by checking a flag */
        if (btn._csBound) return;
        btn._csBound = true;
        btn.addEventListener("click", function () {
          var id = btn.getAttribute("data-cs-remove");
          var wk = btn.getAttribute("data-cs-week");
          if (!log.customSources[wk]) return;
          log.customSources[wk] = log.customSources[wk].filter(function (s) { return s.id !== id; });
          if (!log.customSources[wk].length) delete log.customSources[wk];
          log.updatedAt = new Date().toISOString();
          saveStore(store);
          render();
        });
      });
    }

    function setSubmitStatus(type, msg) {
      if (!submitStatus) return;
      submitStatus.className = "status-" + type;
      submitStatus.textContent = msg;
    }

    function clearSubmitStatus() {
      if (!submitStatus) return;
      submitStatus.className = "";
      submitStatus.textContent = "";
    }

    function submitToSchoolmaster() {
      var program = window.getAcademyProgramBySlug(programSelect.value);
      if (!program) return;

      /* Validate: must have a name saved */
      var name = memberName.value.trim();
      if (!name) {
        memberName.focus();
        memberName.style.borderColor = "#c0392b";
        setTimeout(function () { memberName.style.borderColor = ""; }, 1800);
        setSubmitStatus("err", "Please enter your name in the Member Profile section before submitting.");
        return;
      }

      var log = ensureProgramLog(program.slug);
      var payload = buildSyncPayload(program, log);

      if (submitBtn) submitBtn.disabled = true;
      setSubmitStatus("busy", "Syncing with server…");

      fetch("/api/reading-log/save", {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({
          programSlug:  program.slug,
          programState: payload
        })
      })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || ("Save failed (" + res.status + ")"));
          return data;
        });
      })
      .then(function () {
        setSubmitStatus("busy", "Saving complete. Marking as submitted…");
        return fetch("/api/reading-log/submit", {
          method:      "POST",
          credentials: "include",
          headers:     { "Content-Type": "application/json" },
          body:        JSON.stringify({ programSlug: program.slug })
        });
      })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || ("Submit failed (" + res.status + ")"));
          return data;
        });
      })
      .then(function (data) {
        var submittedAt = data.submittedAt ? new Date(data.submittedAt).toLocaleString() : new Date().toLocaleString();
        /* Persist submission timestamp in local store */
        if (!store.submissions) store.submissions = {};
        store.submissions[program.slug] = submittedAt;
        saveStore(store);

        setSubmitStatus("ok", "✓ Log submitted to Schoolmaster at " + submittedAt + ". The SM dashboard has been updated.");
        updateStaticNote();
      })
      .catch(function (err) {
        var msg = err && err.message ? err.message : "Unknown error.";
        /* 401 = not signed in */
        if (msg.indexOf("401") !== -1 || msg.toLowerCase().indexOf("unauthorized") !== -1) {
          msg = "You must be signed in to submit. Please log in and try again.";
        }
        setSubmitStatus("err", "✗ Submission failed: " + msg);
      })
      .finally(function () {
        if (submitBtn) submitBtn.disabled = false;
      });
    }

    function updateStaticNote() {
      if (!staticNote) return;
      var slug = programSelect.value;
      var lastSub = store.submissions && store.submissions[slug];
      if (lastSub) {
        staticNote.textContent = "Progress is saved in this browser. Last submitted to Schoolmaster: " + lastSub + ". You can submit again any time to update.";
      } else {
        staticNote.textContent = "Progress is saved in this browser only. Use \u2709 Submit to Schoolmaster to send your log directly, or Export JSON for a local backup.";
      }
    }

    memberName.addEventListener("input",   persistProfile);
    memberEmail.addEventListener("input",  persistProfile);
    chapter.addEventListener("input",      persistProfile);
    programSelect.addEventListener("change", function () {
      clearSubmitStatus();
      render();
      updateStaticNote();
    });

    exportBtn.addEventListener("click", function () {
      var program = window.getAcademyProgramBySlug(programSelect.value);
      if (!program) return;
      var log = ensureProgramLog(program.slug);
      var payload = {
        exportType:  "templar-forge-reading-log",
        exportedAt:  new Date().toISOString(),
        member: {
          memberName:  memberName.value.trim(),
          memberEmail: memberEmail.value.trim(),
          chapter:     chapter.value.trim()
        },
        program: {
          slug:  program.slug,
          title: program.title
        },
        log: {
          updatedAt:     log.updatedAt,
          entries:       log.entries,
          customSources: log.customSources || {}
        }
      };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      var filename = [
        slugify(memberName.value || "member"),
        slugify(program.slug    || "program"),
        "reading-log.json"
      ].join("-");
      var url = URL.createObjectURL(blob);
      var anchor = document.createElement("a");
      anchor.href     = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    });

    resetBtn.addEventListener("click", function () {
      var program = window.getAcademyProgramBySlug(programSelect.value);
      if (!program) return;
      if (!confirm("Reset all progress for " + program.title + "? This cannot be undone.")) return;
      store.logs[program.slug] = { updatedAt: "", entries: {}, customSources: {} };
      saveStore(store);
      clearSubmitStatus();
      render();
    });

    if (submitBtn) {
      submitBtn.addEventListener("click", submitToSchoolmaster);
    }

    updateStaticNote();
    render();
  });
})();
