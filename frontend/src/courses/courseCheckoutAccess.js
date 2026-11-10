let checkoutToken = '';

export const setCourseCheckoutToken = (token) => {
  checkoutToken = token || '';
};

export const getCourseCheckoutToken = () => checkoutToken;
