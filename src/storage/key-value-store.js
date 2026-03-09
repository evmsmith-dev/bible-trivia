(function attachBibleTriviaKeyValueStore(globalScope) {
  function createKeyValueStore(options) {
    const config = options && typeof options === "object" ? options : {};
    const log = typeof config.log === "function" ? config.log : function noOpLog() {};

    function getString(storageKey) {
      return String(localStorage.getItem(storageKey) || "");
    }

    function setString(storageKey, value) {
      localStorage.setItem(storageKey, String(value || ""));
    }

    function readDateKey(storageKey) {
      const value = getString(storageKey).trim();
      return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
    }

    function incrementCounter(storageKey) {
      const current = Number.parseInt(getString(storageKey) || "0", 10);
      const next = Number.isFinite(current) ? current + 1 : 1;
      setString(storageKey, String(next));
      return next;
    }

    function remove(storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch (error) {
        log("Failed to remove localStorage key", {
          storageKey,
          message: error && error.message ? error.message : String(error),
        });
      }
    }

    return {
      getString,
      setString,
      readDateKey,
      incrementCounter,
      remove,
    };
  }

  globalScope.BibleTriviaStorage = Object.assign({}, globalScope.BibleTriviaStorage, {
    createKeyValueStore,
  });
})(window);
