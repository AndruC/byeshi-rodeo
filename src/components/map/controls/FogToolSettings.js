import React from "react";
import { Flex } from "theme-ui";

import EdgeSnappingToggle from "./EdgeSnappingToggle";
import RadioIconButton from "./RadioIconButton";
import GridSnappingToggle from "./GridSnappingToggle";

import FogAddIcon from "../../../icons/FogAddIcon";
import FogRemoveIcon from "../../../icons/FogRemoveIcon";
import FogToggleIcon from "../../../icons/FogToggleIcon";

import Divider from "./Divider";

function BrushToolSettings({ settings, onSettingChange }) {
  return (
    <Flex sx={{ alignItems: "center" }}>
      <RadioIconButton
        title="Add Fog"
        onClick={() => onSettingChange({ type: "add" })}
        isSelected={settings.type === "add"}
      >
        <FogAddIcon />
      </RadioIconButton>
      <RadioIconButton
        title="Remove Fog"
        onClick={() => onSettingChange({ type: "remove" })}
        isSelected={settings.type === "remove"}
      >
        <FogRemoveIcon />
      </RadioIconButton>
      <RadioIconButton
        title="Toggle Fog"
        onClick={() => onSettingChange({ type: "toggle" })}
        isSelected={settings.type === "toggle"}
      >
        <FogToggleIcon />
      </RadioIconButton>
      <Divider vertical />
      <EdgeSnappingToggle
        useEdgeSnapping={settings.useEdgeSnapping}
        onEdgeSnappingChange={(useEdgeSnapping) =>
          onSettingChange({ useEdgeSnapping })
        }
      />
      <GridSnappingToggle
        useGridSnapping={settings.useGridSnapping}
        onGridSnappingChange={(useGridSnapping) =>
          onSettingChange({ useGridSnapping })
        }
      />
    </Flex>
  );
}

export default BrushToolSettings;
