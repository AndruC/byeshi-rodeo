import React, { useState, useEffect, useContext } from "react";
import shortid from "shortid";

import DatabaseContext from "./DatabaseContext";

import FakeStorage from "../helpers/FakeStorage";

const AuthContext = React.createContext();

let storage;
try {
  sessionStorage.setItem("__test", "__test");
  sessionStorage.removeItem("__test");
  storage = sessionStorage;
} catch (e) {
  console.warn("Session storage is disabled, no authentication will be saved");
  storage = new FakeStorage();
}

export function AuthProvider({ children }) {
  const { database, databaseStatus } = useContext(DatabaseContext);

  const [password, setPassword] = useState(storage.getItem("auth") || "");

  useEffect(() => {
    storage.setItem("auth", password);
  }, [password]);

  const [authenticationStatus, setAuthenticationStatus] = useState("unknown");

  const [userId, setUserId] = useState();
  useEffect(() => {
    if (!database || databaseStatus === "loading") {
      return;
    }
    async function loadUserId() {
      const storedUserId = await database.table("user").get("userId");
      if (storedUserId) {
        setUserId(storedUserId.value);
      } else {
        const id = shortid.generate();
        setUserId(id);
        database.table("user").add({ key: "userId", value: id });
      }
    }

    loadUserId();
  }, [database, databaseStatus]);

  const value = {
    userId,
    password,
    setPassword,
    authenticationStatus,
    setAuthenticationStatus,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
