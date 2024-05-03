import {useContext} from "react";
import {Web3Context} from "web3";
import Web3AccountContext from "../Wrapping/Web3AccountContext";

/**
 * This is the main page. All the pages should look like this.
 * @returns {JSX.Element}
 */
export default function Main() {
    const context = {...useContext(Web3Context), ...useContext(Web3AccountContext)}

    return <></>;
}