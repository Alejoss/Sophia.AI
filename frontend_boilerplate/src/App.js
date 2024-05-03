import Wrapper from "./Wrapping/Wrapper";
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Main from "./Content/Main";

function App() {
  return (
    <Wrapper expectedChainId={80002} expectedChainName={"Polygon Amoy"}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Main />} />
        </Routes>
      </BrowserRouter>
    </Wrapper>
  );
}

export default App;
