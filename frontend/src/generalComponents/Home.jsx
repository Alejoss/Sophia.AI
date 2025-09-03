import React from "react";
import { Link } from "react-router-dom";

const Home = () => {
  const storedUser = localStorage.getItem("user");
  const username = storedUser ? JSON.parse(storedUser).username : null;

  return (
    <div className="login-wrapper">
      <div className="order-m-2 text-center">
        <img src="images/login-img.png" className="inline-block" alt="" />
      </div>
        <div className="text-box">
          {username ? (
            <h1>
              Are you {username}?{" "}
              <Link to="/profiles/login">Login back again</Link>
            </h1>
          ) : (
            <h1>
              Welcome to Academia Blockchain,{" "}
              <Link to="/profiles/login">login</Link>
            </h1>
          )}
        </div>
    </div>
  );
};

export default Home;
