(function attachBibleTriviaDataRuntime(globalScope) {
  function getFallbackQuestions() {
    return Array.isArray(globalScope.BibleTriviaFallbackQuestions)
      ? globalScope.BibleTriviaFallbackQuestions
      : [];
  }

  function cloneQuestionsWithIds(sourceQuestions) {
    const questions = Array.isArray(sourceQuestions) ? sourceQuestions : [];

    return questions.map((question, index) => ({
      ...question,
      id: Object.prototype.hasOwnProperty.call(question, "id") ? question.id : index + 1,
      opts: Array.isArray(question.opts) ? question.opts.slice() : [],
    }));
  }

  function getPreparedQuestions(input) {
    const payload = input && typeof input === "object" ? input : {};
    const fallbackQuestions = Array.isArray(payload.fallbackQuestions)
      ? payload.fallbackQuestions
      : getFallbackQuestions();
    const bankQuestions = Array.isArray(globalScope.BibleTriviaQuestionBank)
      ? globalScope.BibleTriviaQuestionBank
      : [];
    const sourceQuestions = bankQuestions.length > 0 ? bankQuestions : fallbackQuestions;

    return cloneQuestionsWithIds(sourceQuestions);
  }

  function getAllQuestions() {
    const allQuestions = Array.isArray(globalScope.BibleTriviaQuestionBank)
      ? globalScope.BibleTriviaQuestionBank
      : [];

    return cloneQuestionsWithIds(allQuestions);
  }

  function buildQuestionsById(input) {
    const payload = input && typeof input === "object" ? input : {};
    const questions = Array.isArray(payload.questions) ? payload.questions : [];

    return new Map(questions.map((question) => [question.id, question]));
  }

  function prepareQuestionRuntimePayload(input) {
    const questions = getPreparedQuestions(input);
    const questionsById = buildQuestionsById({ questions });

    return {
      questions,
      questionsById,
    };
  }

  function getQuestionRuntimePayload() {
    const fallbackQuestions = getFallbackQuestions();
    return prepareQuestionRuntimePayload({ fallbackQuestions });
  }

  globalScope.BibleTriviaData = Object.assign({}, globalScope.BibleTriviaData, {
    buildQuestionsById,
    getFallbackQuestions,
    getPreparedQuestions,
    getAllQuestions,
    getQuestionRuntimePayload,
    prepareQuestionRuntimePayload,
  });
})(window);


