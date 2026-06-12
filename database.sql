
-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: mysql-8ea2946-perfection.l.aivencloud.com    Database: defaultdb
-- ------------------------------------------------------
-- Server version	8.4.8

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
SET @MYSQLDUMP_TEMP_LOG_BIN = @@SESSION.SQL_LOG_BIN;
SET @@SESSION.SQL_LOG_BIN= 0;

--
-- GTID state at the beginning of the backup 
--



--
-- Table structure for table `administradores`
--

DROP TABLE IF EXISTS `administradores`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `administradores` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `usuario` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `rol` varchar(50) DEFAULT 'Administrador',
  `estado` varchar(20) DEFAULT 'Activo',
  `fecha_creacion` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `usuario` (`usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `administradores`
--

LOCK TABLES `administradores` WRITE;
/*!40000 ALTER TABLE `administradores` DISABLE KEYS */;
/*!40000 ALTER TABLE `administradores` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `asistencias`
--

DROP TABLE IF EXISTS `asistencias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `asistencias` (
  `id` int NOT NULL AUTO_INCREMENT,
  `codigo_usado` varchar(100) DEFAULT NULL,
  `cliente_id` int NOT NULL,
  `membresia_id` int DEFAULT NULL,
  `codigo` varchar(50) DEFAULT NULL,
  `fecha` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `estado` varchar(20) DEFAULT 'Registrada',
  `motivo` varchar(255) DEFAULT NULL,
  `fecha_hora` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `membresia_id` (`membresia_id`),
  KEY `idx_asistencias_fecha` (`fecha`),
  KEY `idx_asistencias_cliente` (`cliente_id`),
  CONSTRAINT `asistencias_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`),
  CONSTRAINT `asistencias_ibfk_2` FOREIGN KEY (`membresia_id`) REFERENCES `membresias` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `asistencias`
--

LOCK TABLES `asistencias` WRITE;
/*!40000 ALTER TABLE `asistencias` DISABLE KEYS */;
INSERT INTO `asistencias` VALUES (1,'PFS-JHF3J6',1,1,NULL,'2026-06-06 07:06:18','permitido','Ingreso permitido','2026-06-06 07:06:18');
/*!40000 ALTER TABLE `asistencias` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `clientes`
--

DROP TABLE IF EXISTS `clientes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clientes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `dni` varchar(20) NOT NULL,
  `telefono` varchar(20) DEFAULT NULL,
  `correo` varchar(100) DEFAULT NULL,
  `estado` varchar(20) DEFAULT 'Activo',
  `fecha_registro` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `dni` (`dni`),
  KEY `idx_clientes_estado` (`estado`),
  KEY `idx_clientes_dni` (`dni`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clientes`
--

LOCK TABLES `clientes` WRITE;
/*!40000 ALTER TABLE `clientes` DISABLE KEYS */;
INSERT INTO `clientes` VALUES (1,'lucas jara','70594763','980467711','lucasjara1212@gmail.com','activo','2026-06-06 06:45:17');
/*!40000 ALTER TABLE `clientes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `membresias`
--

DROP TABLE IF EXISTS `membresias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `membresias` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cliente_id` int NOT NULL,
  `plan_id` int NOT NULL,
  `codigo` varchar(50) NOT NULL,
  `meses` int NOT NULL DEFAULT '1',
  `fecha_inicio` date NOT NULL,
  `fecha_fin` date NOT NULL,
  `precio` decimal(10,2) DEFAULT '0.00',
  `precio_total` decimal(10,2) NOT NULL DEFAULT '0.00',
  `promocion` varchar(100) DEFAULT NULL,
  `descuento` decimal(10,2) DEFAULT '0.00',
  `estado` varchar(20) DEFAULT 'Activa',
  `origen` varchar(50) NOT NULL DEFAULT 'presencial',
  `fecha_creacion` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `duracion_unidad` enum('dias','meses','usos') DEFAULT 'meses',
  `usos_totales` int DEFAULT NULL,
  `usos_restantes` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `codigo` (`codigo`),
  KEY `idx_membresias_cliente` (`cliente_id`),
  KEY `idx_membresias_plan` (`plan_id`),
  KEY `idx_membresias_codigo` (`codigo`),
  KEY `idx_membresias_fecha_fin` (`fecha_fin`),
  KEY `idx_membresias_estado_fecha_fin` (`estado`,`fecha_fin`),
  CONSTRAINT `membresias_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`),
  CONSTRAINT `membresias_ibfk_2` FOREIGN KEY (`plan_id`) REFERENCES `planes` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `membresias`
--

LOCK TABLES `membresias` WRITE;
/*!40000 ALTER TABLE `membresias` DISABLE KEYS */;
INSERT INTO `membresias` VALUES (1,1,1,'PFS-JHF3J6',1,'2026-06-06','2026-07-06',0.00,80.00,NULL,0.00,'activa','presencial','2026-06-06 07:06:10','meses',NULL,NULL);
/*!40000 ALTER TABLE `membresias` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notificaciones`
--

DROP TABLE IF EXISTS `notificaciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notificaciones` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tipo` varchar(80) NOT NULL,
  `titulo` varchar(160) NOT NULL,
  `mensaje` text NOT NULL,
  `entidad` varchar(80) NOT NULL,
  `entidad_id` int NOT NULL,
  `usuario_id` int DEFAULT NULL,
  `usuario_nombre` varchar(160) DEFAULT NULL,
  `leida` tinyint(1) NOT NULL DEFAULT '0',
  `fecha_creacion` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_notificaciones_evento` (`tipo`,`entidad`,`entidad_id`),
  KEY `idx_notificaciones_leida_fecha` (`leida`,`fecha_creacion`),
  KEY `idx_notificaciones_fecha` (`fecha_creacion`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notificaciones`
--

LOCK TABLES `notificaciones` WRITE;
/*!40000 ALTER TABLE `notificaciones` DISABLE KEYS */;
INSERT INTO `notificaciones` VALUES (1,'cliente_creado','Nuevo cliente registrado','Se registro a lucas jara con DNI 70594763.','cliente',1,1,'Recepción',1,'2026-06-06 06:45:17'),(2,'membresia_creada','Nueva membresia creada','lucas jara adquirio el plan PLAN FUERTE por S/80.00.','membresia',1,1,'Recepción',1,'2026-06-06 07:06:10');
/*!40000 ALTER TABLE `notificaciones` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `planes`
--

DROP TABLE IF EXISTS `planes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `planes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `descripcion` text,
  `precio` decimal(10,2) NOT NULL DEFAULT '0.00',
  `precio_mensual` decimal(10,2) NOT NULL DEFAULT '0.00',
  `tipo` varchar(50) NOT NULL DEFAULT 'General',
  `duracion_dias` int NOT NULL DEFAULT '30',
  `estado` varchar(20) DEFAULT 'Activo',
  `fecha_creacion` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `duracion_valor` int DEFAULT '1',
  `duracion_unidad` enum('dias','meses','usos') DEFAULT 'meses',
  `color_precio` varchar(7) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `planes`
--

LOCK TABLES `planes` WRITE;
/*!40000 ALTER TABLE `planes` DISABLE KEYS */;
INSERT INTO `planes` VALUES (1,'PLAN FUERTE','Plan mensual estándar',80.00,80.00,'General',30,'activo','2026-06-06 06:33:08',1,'meses',NULL),(2,'PLAN INTERDIARIO','Plan semanal',25.00,25.00,'General',7,'activo','2026-06-06 06:33:08',1,'meses',NULL),(3,'PLAN 4 USOS','Plan por un día',10.00,10.00,'General',1,'activo','2026-06-06 06:33:08',4,'usos',NULL);
/*!40000 ALTER TABLE `planes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usuarios_admin`
--

DROP TABLE IF EXISTS `usuarios_admin`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuarios_admin` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `nombre` varchar(100) DEFAULT 'Recepción',
  `estado` varchar(20) DEFAULT 'activo',
  `fecha_creacion` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `usuario` (`usuario`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuarios_admin`
--

LOCK TABLES `usuarios_admin` WRITE;
/*!40000 ALTER TABLE `usuarios_admin` DISABLE KEYS */;
INSERT INTO `usuarios_admin` VALUES (1,'recepcion','$2b$10$yzWr2M8AHGhUSmH9Vl2MUu6p2oCx5Umefmd.VuLSKYuP3ykWcPA3K','Recepción','activo','2026-06-06 06:34:58');
/*!40000 ALTER TABLE `usuarios_admin` ENABLE KEYS */;
UNLOCK TABLES;
SET @@SESSION.SQL_LOG_BIN = @MYSQLDUMP_TEMP_LOG_BIN;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-06  2:13:04
