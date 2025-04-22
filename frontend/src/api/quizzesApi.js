import axiosInstance from './axiosConfig';

const quizApi = {  
  createQuiz: async (pathId, quizData) => {
    try {
      console.log('Creating quiz with data:', {
        path_id: pathId,
        node_id: quizData.precedingNodeId,
        quiz: {
          title: quizData.title,
          description: quizData.description,
          max_attempts_per_day: quizData.max_attempts_per_day,
          questions: quizData.questions
        }
      });

      const quizResponse = await axiosInstance.post(`/quizzes/quiz-create/`, {
        path_id: pathId,
        node_id: quizData.precedingNodeId,
        quiz: {
          title: quizData.title,
          description: quizData.description,
          max_attempts_per_day: quizData.max_attempts_per_day,
          questions: quizData.questions.map(question => ({
            text: question.text,
            question_type: question.questionType,
            image: question.image,
            options: question.options.map(option => ({
              text: option.text,
              is_correct: option.isCorrect
            }))
          }))
        }
      });

      console.log('Quiz creation response:', quizResponse.data);
      return quizResponse.data;
    } catch (error) {
      console.error('Quiz creation error:', {
        error: error,
        response: error.response?.data,
        status: error.response?.status
      });
      throw error;
    }
  },

  getQuiz: async (quizId) => {
    try {
      const response = await axiosInstance.get(`/quizzes/quiz-detail/${quizId}/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching quiz:', error);
      throw error.response?.data || error.message;
    }
  },

  updateQuiz: async (quizId, quizData) => {
    try {
      const requestData = {
        title: quizData.title,
        description: quizData.description,
        node: quizData.precedingNodeId,
        max_attempts_per_day: quizData.max_attempts_per_day,
        questions: quizData.questions.map(question => ({
          text: question.text,
          question_type: question.questionType,
          options: question.options.map(option => ({
            text: option.text,
            is_correct: option.isCorrect
          }))
        }))
      };

      console.log('Making updateQuiz request with data:', requestData);
      console.log('max_attempts_per_day value:', requestData.max_attempts_per_day);
      console.log('max_attempts_per_day type:', typeof requestData.max_attempts_per_day);
      
      const response = await axiosInstance.put(`/quizzes/quiz-detail/${quizId}/`, requestData);
      return response.data;
    } catch (error) {
      console.error('Error updating quiz:', error);
      console.error('Failed request data:', error.config?.data);
      throw error;
    }
  },

  deleteQuiz: async (quizId) => {
    try {
      await axiosInstance.delete(`/quizzes/quiz-detail/${quizId}/`);
    } catch (error) {
      console.error('Error deleting quiz:', error);
      throw error.response?.data || error.message;
    }
  },

  // Function to get quizzes by knowledge path ID
  getQuizzesByPathId: async (pathId) => {
    try {
      const response = await axiosInstance.get(`/quizzes/knowledge-paths/${pathId}/quizzes/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching quizzes:', error);
      throw error;
    }
  },

  submitQuiz: async (quizId, data) => {
    try {
      console.log('Making quiz submission request:', {
        url: `/quizzes/quiz/${quizId}/submit/`,
        data
      });

      const response = await axiosInstance.post(`/quizzes/quiz/${quizId}/submit/`, data);
      console.log('Successful response data:', response.data);
      return response.data;

    } catch (error) {
      console.error('Quiz submission request failed:', error);
      throw error.response?.data || error.message;
    }
  }
};

export default quizApi; 