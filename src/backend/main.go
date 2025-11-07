package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/gorilla/mux"
	"github.com/rs/cors"
)

// el servidor que mantiene la config y configuración del contrato
type Server struct {
	client          *ethclient.Client
	contractAddress common.Address
}

// representa como se ve un certificado
type Certificate struct {
	StudentAddress  string `json:"studentAddress"`
	CertificateHash string `json:"certificateHash"`
	Institution     string `json:"institution"`
	Timestamp       uint64 `json:"timestamp"`
}

// Estas dos son como respuestas estandar para ambos casos

type HealthResponse struct {
	Status    string `json:"status"`
	Timestamp string `json:"timestamp"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

func main() {
	// conectar a la blockchain local (Hardhat)
	blockchainURL := getEnv("BLOCKCHAIN_URL", "http://localhost:8545")
	client, err := ethclient.Dial(blockchainURL)
	if err != nil {
		log.Fatalf("Failed to connect to blockchain: %v", err)
	}
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err = client.BlockNumber(ctx)
	if err != nil {
		log.Printf("Warning: Could not fetch block number: %v", err)
	} else {
		log.Println("Successfully connected to blockchain")
	}

	contractAddr := getEnv("CONTRACT_ADDRESS", "0x5FbDB2315678afecb367f032d93F642f64180aa3")

	server := &Server{
		client:          client,
		contractAddress: common.HexToAddress(contractAddr),
	}

	router := mux.NewRouter()

	router.HandleFunc("/health", server.healthHandler).Methods("GET")
	router.HandleFunc("/api/contract/address", server.getContractAddress).Methods("GET")
	router.HandleFunc("/api/certificates/verify/{hash}", server.verifyCertificate).Methods("GET")
	router.HandleFunc("/api/certificates/count", server.getCertificateCount).Methods("GET")
	router.HandleFunc("/api/blockchain/block", server.getBlockNumber).Methods("GET")

	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	})

	handler := c.Handler(router)

	port := getEnv("PORT", "8080")
	log.Printf("Server starting on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}

func (s *Server) healthHandler(w http.ResponseWriter, r *http.Request) {
	response := HealthResponse{
		Status:    "ok",
		Timestamp: time.Now().Format(time.RFC3339),
	}
	jsonResponse(w, http.StatusOK, response)
}

func (s *Server) getContractAddress(w http.ResponseWriter, r *http.Request) {
	response := map[string]string{
		"address": s.contractAddress.Hex(),
	}
	jsonResponse(w, http.StatusOK, response)
}

func (s *Server) getBlockNumber(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	blockNumber, err := s.client.BlockNumber(ctx)
	if err != nil {
		errorResponse(w, http.StatusInternalServerError, fmt.Sprintf("Failed to get block number: %v", err))
		return
	}

	response := map[string]interface{}{
		"blockNumber": blockNumber,
	}
	jsonResponse(w, http.StatusOK, response)
}

func (s *Server) verifyCertificate(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	hash := vars["hash"]

	if hash == "" {
		errorResponse(w, http.StatusBadRequest, "Certificate hash is required")
		return
	}

	// esto es una mock response, en una impl de prod necesitaría un contract bind
	response := map[string]interface{}{
		"exists":   true,
		"hash":     hash,
		"verified": true,
		"message":  "Certificate verification requires direct blockchain interaction via frontend",
	}
	jsonResponse(w, http.StatusOK, response)
}

func (s *Server) getCertificateCount(w http.ResponseWriter, r *http.Request) {
	// esto también es una mock response
	response := map[string]interface{}{
		"count":   0,
		"message": "Certificate count requires smart contract interaction",
	}
	jsonResponse(w, http.StatusOK, response)
}

func jsonResponse(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func errorResponse(w http.ResponseWriter, status int, message string) {
	response := ErrorResponse{Error: message}
	jsonResponse(w, status, response)
}

func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}
