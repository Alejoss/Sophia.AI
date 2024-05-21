// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract MyToken is ERC20, Ownable, ERC20Permit {
    constructor(
        address initialOwner,
        uint256 initialSupply
    )
        ERC20("ACBCToken", "ACBC")
        Ownable(initialOwner)
        ERC20Permit("AcademiaBlockchainToken")
    {
        _mint(initialOwner, initialSupply);
    }

    // Mint function
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    // Burn functions
    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }

    function burnFrom(address account, uint256 amount) public {
        uint256 currentAllowance = allowance(account, msg.sender);
        require(currentAllowance >= amount, "ERC20: burn amount exceeds allowance");
        unchecked {
            _approve(account, msg.sender, currentAllowance - amount);
        }
        _burn(account, amount);
    }
}
