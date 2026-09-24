import { useSelector } from "react-redux";
import { ROLES } from "../../lib/constants";
import MyBloodPage from "./MyBloodPage";
import StockPage from "./StockPage";

/** The first tab is different for every kind of user. */
export default function HomePage() {
  const { user } = useSelector((state) => state.auth);
  return user.role === ROLES.ORGANISATION ? <StockPage /> : <MyBloodPage />;
}
