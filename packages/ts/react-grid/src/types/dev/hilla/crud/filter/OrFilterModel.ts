import {
    _getPropertyModel as _getPropertyModel_1,
    ArrayModel as ArrayModel_1,
    makeObjectEmptyValueCreator,
    ObjectModel as ObjectModel_1
} from "@hilla/form";
import FilterModel_1 from "./FilterModel.js";
import type OrFilter_1 from "./OrFilter.js";
class OrFilterModel<T extends OrFilter_1 = OrFilter_1> extends ObjectModel_1<T> {
    static override createEmptyValue = makeObjectEmptyValueCreator(OrFilterModel);
    get children(): ArrayModel_1<FilterModel_1> {
        return this[_getPropertyModel_1]("children", (parent, key) =>
            new ArrayModel_1(parent, key, false, (parent, key) =>
              new FilterModel_1(parent, key, false)
            )
        );
    }
}
export default OrFilterModel;
