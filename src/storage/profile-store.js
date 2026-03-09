(function attachBibleTriviaProfileStore(globalScope) {
  function createPlayerProfileStore(options) {
    const config = options && typeof options === "object" ? options : {};
    const storageKey = String(config.storageKey || "");
    const createDefaultProfile = typeof config.createDefaultProfile === "function"
      ? config.createDefaultProfile
      : function fallbackCreateDefaultProfile() {
        return {
          id: "primary",
          name: "Player",
          avatarId: "emoji-smile",
          nonDailyCorrectAnswers: 0,
        };
      };
    const sanitizeProfile = typeof config.sanitizeProfile === "function"
      ? config.sanitizeProfile
      : function fallbackSanitizeProfile(rawProfile) {
        const raw = rawProfile && typeof rawProfile === "object" ? rawProfile : {};
        return {
          id: String(raw.id || "primary"),
          name: String(raw.name || "Player"),
          avatarId: String(raw.avatarId || "emoji-smile"),
          nonDailyCorrectAnswers: Number.isFinite(raw.nonDailyCorrectAnswers)
            ? Math.max(0, Math.round(raw.nonDailyCorrectAnswers))
            : 0,
        };
      };

    const log = typeof config.log === "function" ? config.log : function noOpLog() {};

    function loadFromStorage() {
      if (!storageKey) {
        return createDefaultProfile();
      }

      const rawSaved = localStorage.getItem(storageKey);
      if (!rawSaved) {
        return createDefaultProfile();
      }

      try {
        return sanitizeProfile(JSON.parse(rawSaved));
      } catch (error) {
        log("Failed to parse player profile", error && error.message ? error.message : String(error));
        return createDefaultProfile();
      }
    }

    function ensureLoaded(currentProfile) {
      const loaded = currentProfile ? sanitizeProfile(currentProfile) : loadFromStorage();
      return sanitizeProfile(loaded);
    }

    function save(profile) {
      if (!storageKey) {
        return;
      }
      const sanitized = ensureLoaded(profile);
      localStorage.setItem(storageKey, JSON.stringify(sanitized));
    }

    function saveSafely(profile) {
      try {
        save(profile);
      } catch (error) {
        log("Failed to persist player profile", error && error.message ? error.message : String(error));
      }
    }

    return {
      ensureLoaded,
      save,
      saveSafely,
    };
  }

  globalScope.BibleTriviaStorage = Object.assign({}, globalScope.BibleTriviaStorage, {
    createPlayerProfileStore,
  });
})(window);
