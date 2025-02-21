import axiosInstance from './axiosConfig';

const quizApi = {
  createQuiz: async (pathId, quizData) => {
    try {
      // First create the activity requirement
      const activityResponse = await axiosInstance.post(`/knowledge_paths/${pathId}/activity-requirements/`, {
        activity_type: 'QUIZ',
        description: quizData.description
      });

      const activityRequirementId = activityResponse.data.id;

      // Then create the quiz with its questions and options
      const quizResponse = await axiosInstance.post(`/exams/quizzes/`, {
        activity_requirement: activityRequirementId,
        title: quizData.title,
        description: quizData.description,
        preceding_node: quizData.precedingNodeId,
        questions: quizData.questions.map(question => ({
          text: question.text,
          question_type: question.questionType,
          image: question.image,
          options: question.options.map(option => ({
            text: option.text,
            is_correct: option.isCorrect
          }))
        }))
      });

      return quizResponse.data;
    } catch (error) {
      console.error('Error creating quiz:', error);
      throw error.response?.data || error.message;
    }
  },

  getQuiz: async (quizId) => {
    try {
      const response = await axiosInstance.get(`/api/quizzes/${quizId}/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching quiz:', error);
      throw error.response?.data || error.message;
    }
  },

  updateQuiz: async (quizId, quizData) => {
    try {
      const response = await axiosInstance.put(`/api/quizzes/${quizId}/`, quizData);
      return response.data;
    } catch (error) {
      console.error('Error updating quiz:', error);
      throw error.response?.data || error.message;
    }
  },

  deleteQuiz: async (quizId) => {
    try {
      await axiosInstance.delete(`/api/quizzes/${quizId}/`);
    } catch (error) {
      console.error('Error deleting quiz:', error);
      throw error.response?.data || error.message;
    }
  }
};

export default quizApi; 