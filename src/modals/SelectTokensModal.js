import React, { useRef, useState, useEffect } from "react";
import { Flex, Label, Button, Box } from "theme-ui";
import { useToasts } from "react-toast-notifications";
import ReactResizeDetector from "react-resize-detector";

import EditTokenModal from "./EditTokenModal";
import ConfirmModal from "./ConfirmModal";

import Modal from "../components/Modal";
import LoadingOverlay from "../components/LoadingOverlay";

import ImageDrop from "../components/image/ImageDrop";

import TokenTiles from "../components/token/TokenTiles";
import TokenEditBar from "../components/token/TokenEditBar";

import TilesOverlay from "../components/tile/TilesOverlay";
import TilesContainer from "../components/tile/TilesContainer";
import TileActionBar from "../components/tile/TileActionBar";

import { getGroupItems, getItemNames } from "../helpers/group";
import {
  createTokenFromFile,
  createTokenState,
  clientPositionToMapPosition,
} from "../helpers/token";
import Vector2 from "../helpers/Vector2";

import useResponsiveLayout from "../hooks/useResponsiveLayout";

import { useTokenData } from "../contexts/TokenDataContext";
import { useUserId } from "../contexts/UserIdContext";
import { useAssets } from "../contexts/AssetsContext";
import { GroupProvider } from "../contexts/GroupContext";
import { TileDragProvider } from "../contexts/TileDragContext";
import { useMapStage } from "../contexts/MapStageContext";

function SelectTokensModal({ isOpen, onRequestClose, onMapTokensStateCreate }) {
  const { addToast } = useToasts();

  const userId = useUserId();
  const {
    tokens,
    addToken,
    tokensLoading,
    tokenGroups,
    updateTokenGroups,
    updateToken,
    tokensById,
  } = useTokenData();
  const { addAssets } = useAssets();

  // Get token names for group filtering
  const [tokenNames, setTokenNames] = useState(getItemNames(tokens));
  useEffect(() => {
    setTokenNames(getItemNames(tokens));
  }, [tokens]);

  /**
   * Image Upload
   */

  const fileInputRef = useRef();
  const [isLoading, setIsLoading] = useState(false);

  const [isLargeImageWarningModalOpen, setShowLargeImageWarning] = useState(
    false
  );
  const largeImageWarningFiles = useRef();

  async function handleImagesUpload(files) {
    if (navigator.storage) {
      // Attempt to enable persistant storage
      await navigator.storage.persist();
    }

    let tokenFiles = [];
    for (let file of files) {
      if (file.size > 5e7) {
        addToast(`Unable to import token ${file.name} as it is over 50MB`);
      } else {
        tokenFiles.push(file);
      }
    }

    // Any file greater than 20MB
    if (tokenFiles.some((file) => file.size > 2e7)) {
      largeImageWarningFiles.current = tokenFiles;
      setShowLargeImageWarning(true);
      return;
    }

    for (let file of tokenFiles) {
      await handleImageUpload(file);
    }

    clearFileInput();
  }

  function clearFileInput() {
    // Set file input to null to allow adding the same image 2 times in a row
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
    }
  }

  function openImageDialog() {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }

  function handleLargeImageWarningCancel() {
    largeImageWarningFiles.current = undefined;
    setShowLargeImageWarning(false);
    clearFileInput();
  }

  async function handleLargeImageWarningConfirm() {
    setShowLargeImageWarning(false);
    const files = largeImageWarningFiles.current;
    for (let file of files) {
      await handleImageUpload(file);
    }
    largeImageWarningFiles.current = undefined;
    clearFileInput();
  }

  async function handleImageUpload(file) {
    setIsLoading(true);
    const { token, assets } = await createTokenFromFile(file, userId);
    await addToken(token);
    await addAssets(assets);
    setIsLoading(false);
  }

  /**
   * Token controls
   */
  const [editingTokenId, setEditingTokenId] = useState();

  const [isDraggingToken, setIsDraggingToken] = useState(false);

  const mapStageRef = useMapStage();
  function handleTokensAddToMap(groupIds, rect) {
    let clientPosition = new Vector2(
      rect.width / 2 + rect.left,
      rect.height / 2 + rect.top
    );
    const mapStage = mapStageRef.current;
    if (!mapStage) {
      return;
    }

    let position = clientPositionToMapPosition(mapStage, clientPosition, false);
    if (!position) {
      return;
    }

    let newTokenStates = [];

    for (let id of groupIds) {
      if (id in tokensById) {
        newTokenStates.push(createTokenState(tokensById[id], position, userId));
        position = Vector2.add(position, 0.01);
      } else {
        // Check if a group is selected
        const group = tokenGroups.find(
          (group) => group.id === id && group.type === "group"
        );
        if (group) {
          // Add all tokens of group
          const items = getGroupItems(group);
          for (let item of items) {
            if (item.id in tokensById) {
              newTokenStates.push(
                createTokenState(tokensById[item.id], position, userId)
              );
              position = Vector2.add(position, 0.01);
            }
          }
        }
      }
    }

    if (newTokenStates.length > 0) {
      onMapTokensStateCreate(newTokenStates);
    }
  }

  const layout = useResponsiveLayout();

  const [modalSize, setModalSize] = useState({ width: 0, height: 0 });
  function handleModalResize(width, height) {
    setModalSize({ width, height });
  }

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      style={{ maxWidth: layout.modalSize, width: "calc(100% - 16px)" }}
      shouldCloseOnEsc={!isDraggingToken}
    >
      <ImageDrop onDrop={handleImagesUpload} dropText="Drop token to import">
        <input
          onChange={(event) => handleImagesUpload(event.target.files)}
          type="file"
          accept="image/jpeg, image/gif, image/png, image/webp"
          style={{ display: "none" }}
          ref={fileInputRef}
          multiple
        />
        <ReactResizeDetector
          handleWidth
          handleHeight
          onResize={handleModalResize}
          refreshMode="debounce"
        >
          <GroupProvider
            groups={tokenGroups}
            itemNames={tokenNames}
            onGroupsChange={updateTokenGroups}
            disabled={!isOpen}
          >
            <Flex
              sx={{
                flexDirection: "column",
              }}
            >
              <Label pt={2} pb={1}>
                Edit or import a token
              </Label>
              <TileActionBar
                onAdd={openImageDialog}
                addTitle="Import Token(s)"
              />
              <Box sx={{ position: "relative" }}>
                <TileDragProvider
                  onDragAdd={handleTokensAddToMap}
                  onDragStart={() => setIsDraggingToken(true)}
                  onDragEnd={() => setIsDraggingToken(false)}
                  onDragCancel={() => setIsDraggingToken(false)}
                >
                  <TilesContainer>
                    <TokenTiles
                      tokensById={tokensById}
                      onTokenEdit={setEditingTokenId}
                    />
                  </TilesContainer>
                </TileDragProvider>
                <TileDragProvider
                  onDragAdd={handleTokensAddToMap}
                  onDragStart={() => setIsDraggingToken(true)}
                  onDragEnd={() => setIsDraggingToken(false)}
                  onDragCancel={() => setIsDraggingToken(false)}
                >
                  <TilesOverlay modalSize={modalSize}>
                    <TokenTiles
                      tokensById={tokensById}
                      onTokenEdit={setEditingTokenId}
                      subgroup
                    />
                  </TilesOverlay>
                </TileDragProvider>
                <TokenEditBar
                  onLoad={setIsLoading}
                  disabled={isLoading || !isOpen}
                />
              </Box>
              <Button
                variant="primary"
                disabled={isLoading}
                onClick={onRequestClose}
                mt={2}
              >
                Done
              </Button>
            </Flex>
          </GroupProvider>
        </ReactResizeDetector>
      </ImageDrop>
      {(isLoading || tokensLoading) && <LoadingOverlay bg="overlay" />}
      <EditTokenModal
        isOpen={!!editingTokenId}
        onDone={() => setEditingTokenId()}
        token={
          editingTokenId && tokens.find((token) => token.id === editingTokenId)
        }
        onUpdateToken={updateToken}
      />
      <ConfirmModal
        isOpen={isLargeImageWarningModalOpen}
        onRequestClose={handleLargeImageWarningCancel}
        onConfirm={handleLargeImageWarningConfirm}
        confirmText="Continue"
        label="Warning"
        description="An imported image is larger than 20MB, this may cause slowness. Continue?"
      />
    </Modal>
  );
}

export default SelectTokensModal;
