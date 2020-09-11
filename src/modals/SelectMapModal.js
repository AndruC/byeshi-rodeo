import React, { useRef, useState, useContext } from "react";
import { Button, Flex, Label } from "theme-ui";
import shortid from "shortid";

import Modal from "../components/Modal";
import MapTiles from "../components/map/MapTiles";
import MapSettings from "../components/map/MapSettings";
import ImageDrop from "../components/ImageDrop";
import LoadingOverlay from "../components/LoadingOverlay";

import blobToBuffer from "../helpers/blobToBuffer";

import MapDataContext from "../contexts/MapDataContext";
import AuthContext from "../contexts/AuthContext";

import { isEmpty } from "../helpers/shared";
import { resizeImage } from "../helpers/image";

const defaultMapSize = 22;
const defaultMapProps = {
  // Grid type
  // TODO: add support for hex horizontal and hex vertical
  gridType: "grid",
  showGrid: false,
  snapToGrid: true,
  quality: "original",
};

const mapResolutions = [
  { size: 512, quality: 0.5, id: "low" },
  { size: 1024, quality: 0.6, id: "medium" },
  { size: 2048, quality: 0.7, id: "high" },
  { size: 4096, quality: 0.8, id: "ultra" },
];

function SelectMapModal({
  isOpen,
  onDone,
  onMapChange,
  onMapStateChange,
  // The map currently being view in the map screen
  currentMap,
}) {
  const { userId } = useContext(AuthContext);
  const {
    ownedMaps,
    mapStates,
    addMap,
    removeMap,
    resetMap,
    updateMap,
    updateMapState,
  } = useContext(MapDataContext);

  const [imageLoading, setImageLoading] = useState(false);

  // The map selected in the modal
  const [selectedMapId, setSelectedMapId] = useState(null);

  const selectedMap = ownedMaps.find((map) => map.id === selectedMapId);
  const selectedMapState = mapStates.find(
    (state) => state.mapId === selectedMapId
  );

  const fileInputRef = useRef();

  async function handleImagesUpload(files) {
    for (let file of files) {
      await handleImageUpload(file);
    }
    // Set file input to null to allow adding the same image 2 times in a row
    fileInputRef.current.value = null;
  }

  async function handleImageUpload(file) {
    if (!file) {
      return Promise.reject();
    }
    let fileGridX = defaultMapSize;
    let fileGridY = defaultMapSize;
    let name = "Unknown Map";
    if (file.name) {
      // TODO: match all not supported on safari, find alternative
      if (file.name.matchAll) {
        // Match against a regex to find the grid size in the file name
        // e.g. Cave 22x23 will return [["22x22", "22", "x", "23"]]
        const gridMatches = [...file.name.matchAll(/(\d+) ?(x|X) ?(\d+)/g)];
        if (gridMatches.length > 0) {
          const lastMatch = gridMatches[gridMatches.length - 1];
          const matchX = parseInt(lastMatch[1]);
          const matchY = parseInt(lastMatch[3]);
          if (!isNaN(matchX) && !isNaN(matchY)) {
            fileGridX = matchX;
            fileGridY = matchY;
          }
        }
      }

      // Remove file extension
      name = file.name.replace(/\.[^/.]+$/, "");
      // Removed grid size expression
      name = name.replace(/(\[ ?|\( ?)?\d+ ?(x|X) ?\d+( ?\]| ?\))?/, "");
      // Clean string
      name = name.replace(/ +/g, " ");
      name = name.trim();
    }
    let image = new Image();
    setImageLoading(true);

    const buffer = await blobToBuffer(file);
    // Copy file to avoid permissions issues
    const blob = new Blob([buffer]);
    // Create and load the image temporarily to get its dimensions
    const url = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
      image.onload = async function () {
        // Create resolutions
        const resolutions = {};
        for (let resolution of mapResolutions) {
          if (Math.max(image.width, image.height) > resolution.size) {
            const resized = await resizeImage(
              image,
              resolution.size,
              file.type,
              resolution.quality
            );
            const resizedBuffer = await blobToBuffer(resized.blob);
            resolutions[resolution.id] = {
              file: resizedBuffer,
              width: resized.width,
              height: resized.height,
              type: "file",
              id: resolution.id,
            };
          }
        }

        handleMapAdd({
          // Save as a buffer to send with msgpack
          file: buffer,
          resolutions,
          name,
          type: "file",
          gridX: fileGridX,
          gridY: fileGridY,
          width: image.width,
          height: image.height,
          id: shortid.generate(),
          created: Date.now(),
          lastModified: Date.now(),
          lastUsed: Date.now(),
          owner: userId,
          ...defaultMapProps,
        });
        setImageLoading(false);
        URL.revokeObjectURL(url);
        resolve();
      };
      image.onerror = reject;
      image.src = url;
    });
  }

  function openImageDialog() {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }

  async function handleMapAdd(map) {
    await addMap(map);
    setSelectedMapId(map.id);
  }

  async function handleMapRemove(id) {
    await removeMap(id);
    setMapSettingChanges({});
    setMapStateSettingChanges({});
    setSelectedMapId(null);
    // Removed the map from the map screen if needed
    if (currentMap && currentMap.id === selectedMapId) {
      onMapChange(null, null);
    }
  }

  async function handleMapSelect(map) {
    await applyMapChanges();
    if (map) {
      setSelectedMapId(map.id);
    } else {
      setSelectedMapId(null);
    }
  }

  async function handleMapReset(id) {
    const newState = await resetMap(id);
    // Reset the state of the current map if needed
    if (currentMap && currentMap.id === selectedMapId) {
      onMapStateChange(newState);
    }
  }

  async function handleClose() {
    if (selectedMapId) {
      await applyMapChanges();
    }
    onDone();
  }

  async function handleDone() {
    if (imageLoading) {
      return;
    }
    if (selectedMapId) {
      await applyMapChanges();
      // Update last used for cache invalidation
      const lastUsed = Date.now();
      await updateMap(selectedMapId, { lastUsed });
      onMapChange(
        { ...selectedMapWithChanges, lastUsed },
        selectedMapStateWithChanges
      );
    } else {
      onMapChange(null, null);
    }
    onDone();
  }

  /**
   * Map settings
   */
  const [showMoreSettings, setShowMoreSettings] = useState(false);
  // Local cache of map setting changes
  // Applied when done is clicked or map selection is changed
  const [mapSettingChanges, setMapSettingChanges] = useState({});
  const [mapStateSettingChanges, setMapStateSettingChanges] = useState({});

  function handleMapSettingsChange(key, value) {
    setMapSettingChanges((prevChanges) => ({
      ...prevChanges,
      [key]: value,
      lastModified: Date.now(),
    }));
  }

  function handleMapStateSettingsChange(key, value) {
    setMapStateSettingChanges((prevChanges) => ({
      ...prevChanges,
      [key]: value,
    }));
  }

  async function applyMapChanges() {
    if (
      selectedMapId &&
      (!isEmpty(mapSettingChanges) || !isEmpty(mapStateSettingChanges))
    ) {
      // Ensure grid values are positive
      let verifiedChanges = { ...mapSettingChanges };
      if ("gridX" in verifiedChanges) {
        verifiedChanges.gridX = verifiedChanges.gridX || 1;
      }
      if ("gridY" in verifiedChanges) {
        verifiedChanges.gridY = verifiedChanges.gridY || 1;
      }
      await updateMap(selectedMapId, verifiedChanges);
      await updateMapState(selectedMapId, mapStateSettingChanges);

      setMapSettingChanges({});
      setMapStateSettingChanges({});
    }
  }

  const selectedMapWithChanges = selectedMap && {
    ...selectedMap,
    ...mapSettingChanges,
  };
  const selectedMapStateWithChanges = selectedMapState && {
    ...selectedMapState,
    ...mapStateSettingChanges,
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={handleClose}
      style={{ maxWidth: "542px", width: "calc(100% - 16px)" }}
    >
      <ImageDrop onDrop={handleImagesUpload} dropText="Drop map to upload">
        <input
          onChange={(event) => handleImagesUpload(event.target.files)}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          multiple
          ref={fileInputRef}
        />
        <Flex
          sx={{
            flexDirection: "column",
          }}
        >
          <Label pt={2} pb={1}>
            Select or import a map
          </Label>
          <MapTiles
            maps={ownedMaps}
            onMapAdd={openImageDialog}
            onMapRemove={handleMapRemove}
            selectedMap={selectedMapWithChanges}
            selectedMapState={selectedMapStateWithChanges}
            onMapSelect={handleMapSelect}
            onMapReset={handleMapReset}
            onDone={handleDone}
          />
          <MapSettings
            map={selectedMapWithChanges}
            mapState={selectedMapStateWithChanges}
            onSettingsChange={handleMapSettingsChange}
            onStateSettingsChange={handleMapStateSettingsChange}
            showMore={showMoreSettings}
            onShowMoreChange={setShowMoreSettings}
          />
          <Button
            variant="primary"
            disabled={imageLoading}
            onClick={handleDone}
          >
            Done
          </Button>
        </Flex>
      </ImageDrop>
      {imageLoading && <LoadingOverlay bg="overlay" />}
    </Modal>
  );
}

export default SelectMapModal;